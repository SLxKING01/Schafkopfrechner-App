import { useEffect } from 'react';

import { subscribeToTable } from '../services/realtime/subscribeToTable';
import { unsubscribeFromTable } from '../services/realtime/unsubscribeFromTable';
import { useGameStore } from '../store/gameStore';

export function useRealtimeTable(tableId?: string) {
  const syncNow = useGameStore((state) => state.syncNow);

  useEffect(() => {
    if (!tableId) {
      return undefined;
    }

    const subscription = subscribeToTable(tableId, {
      onEvent: () => {
        void syncNow();
      },
      onError: () => {
        void syncNow();
      },
    });

    return () => {
      unsubscribeFromTable(subscription);
    };
  }, [syncNow, tableId]);
}
