import { useEffect, useRef } from 'react';
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

// Realtime is the primary change signal; polling is only a safety net.
const FALLBACK_POLL_MS = 60000;
const DEGRADED_POLL_MS = 15000;
const RETRY_MIN_MS = 5000;
const REALTIME_DEBOUNCE_MS = 300;

export function useCloudSync(ready: boolean) {
  const userId = useAuthStore((state) => state.user?.id);
  const realtimeLive = useRef(false);
  useEffect(() => {
    if (!ready || !userId) return;
    let signal: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(signal);
      signal = setTimeout(() => {
        void refreshSharedTables()
          .then(syncSharedTable)
          .catch(() => undefined);
      }, REALTIME_DEBOUNCE_MS);
    };
    const channel = supabase
      .channel(`shared-tables:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sk_live_tables',
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sk_live_members',
          filter: `user_id=eq.${userId}`,
        },
        refresh,
      )
      .subscribe((status) => {
        realtimeLive.current = status === 'SUBSCRIBED';
        if (status === 'SUBSCRIBED') refresh();
      });
    return () => {
      clearTimeout(signal);
      realtimeLive.current = false;
      void supabase.removeChannel(channel);
    };
  }, [ready, userId]);
  useEffect(() => {
    if (!ready || !userId) return;
    let timer: ReturnType<typeof setTimeout>;
    let poll: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let failures = 0;
    // Pending uploads retry with backoff; otherwise poll rarely, and a bit more
    // often while the realtime channel is down.
    const schedule = () => {
      clearTimeout(poll);
      if (stopped) return;
      const state = useGameStore.getState();
      const pending = failures > 0 || !!state.isOffline || !!state.syncError;
      const delay = pending
        ? Math.min(
            RETRY_MIN_MS * 2 ** Math.max(failures - 1, 0),
            FALLBACK_POLL_MS,
          )
        : realtimeLive.current
          ? FALLBACK_POLL_MS
          : DEGRADED_POLL_MS;
      poll = setTimeout(sync, delay);
    };
    const signature = () =>
      fingerprint([
        captureGameState(),
        useGameStore
          .getState()
          .archivedGameDays.filter((day) => day.table.shared),
      ]);
    let previous = signature();
    const sync = () => {
      clearTimeout(poll);
      if (AppState.currentState !== 'active') return;
      if (useAuthStore.getState().user?.id !== userId) return;
      void (async () => {
        const discovered = await refreshSharedTables();
        if (useAuthStore.getState().user?.id !== userId) return;
        await syncSharedTable(discovered);
        if (!useGameStore.getState().currentTable?.shared)
          await useGameStore.getState().syncNow();
        failures = 0;
      })()
        .catch(() => {
          failures += 1;
          if (useAuthStore.getState().user?.id !== userId) return;
          useGameStore.setState({
            isOffline: true,
            syncError:
              'Cloud-Abgleich fehlgeschlagen. Lokale Daten bleiben erhalten. Bitte erneut versuchen.',
          });
        })
        .finally(schedule);
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
    sync();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(poll);
      listener.remove();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [ready, userId]);
}
