import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';
import {
  refreshSharedTables,
  syncSharedTable,
} from '../services/shared/sharedTables';
import {
  applyingCloudState,
  captureGameState,
  fingerprint,
} from '../services/sync/syncGameState';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';

export function useCloudSync(ready: boolean) {
  const userId = useAuthStore((state) => state.user?.id);
  useEffect(() => {
    if (!ready || !userId) return;
    const channel = supabase
      .channel(`shared-tables:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sk_live_tables',
        },
        () => {
          void refreshSharedTables().then(syncSharedTable);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sk_live_members',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshSharedTables().then(syncSharedTable);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED')
          void refreshSharedTables().then(syncSharedTable);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ready, userId]);
  useEffect(() => {
    if (!ready || !userId) return;
    let timer: ReturnType<typeof setTimeout>;
    const signature = () =>
      fingerprint([
        captureGameState(),
        useGameStore
          .getState()
          .archivedGameDays.filter((day) => day.table.shared),
      ]);
    let previous = signature();
    const sync = () => {
      if (AppState.currentState !== 'active') return;
      if (useAuthStore.getState().user?.id !== userId) return;
      void (async () => {
        await syncSharedTable();
        await refreshSharedTables();
        if (!useGameStore.getState().currentTable?.shared)
          await useGameStore.getState().syncNow();
      })().catch(() => {
        if (useAuthStore.getState().user?.id !== userId) return;
        useGameStore.setState({
          isOffline: true,
          syncError:
            'Cloud-Abgleich fehlgeschlagen. Lokale Daten bleiben erhalten. Bitte erneut versuchen.',
        });
      });
    };
    const changed = () => {
      const next = signature();
      if (next === previous) return;
      previous = next;
      if (applyingCloudState) return;
      if (!useGameStore.getState().currentTable?.shared)
        useGameStore.setState({ isOffline: true });
      clearTimeout(timer);
      timer = setTimeout(sync, 700);
    };
    const unsubscribers = [
      useGameStore.subscribe(changed),
      usePlayerStore.subscribe(changed),
      useMatchDayStore.subscribe(changed),
    ];
    const listener = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') sync();
    });
    // Polling also retries failed uploads after connectivity returns.
    const interval = setInterval(sync, 5000);
    sync();
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      listener.remove();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [ready, userId]);
}
