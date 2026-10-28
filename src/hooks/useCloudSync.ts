import { useEffect } from 'react';
import { AppState } from 'react-native';

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
    let timer: ReturnType<typeof setTimeout>;
    let previous = fingerprint(captureGameState());
    const sync = () => {
      void useGameStore.getState().syncNow();
    };
    const changed = () => {
      const next = fingerprint(captureGameState());
      if (next === previous) return;
      previous = next;
      if (applyingCloudState) return;
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
      if (state === 'active') sync();
    });
    // Polling also retries failed uploads after connectivity returns.
    const interval = setInterval(() => {
      if (AppState.currentState !== 'background') sync();
    }, 30000);
    sync();
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      listener.remove();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [ready, userId]);
}
