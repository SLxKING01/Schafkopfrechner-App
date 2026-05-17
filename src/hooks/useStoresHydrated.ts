import { useEffect, useState } from 'react';

import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';

export function useStoresHydrated() {
  const [isHydrated, setIsHydrated] = useState(
    usePlayerStore.persist.hasHydrated() &&
      useGameStore.persist.hasHydrated() &&
      useMatchDayStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const updateHydrationState = () => {
      setIsHydrated(
        usePlayerStore.persist.hasHydrated() &&
          useGameStore.persist.hasHydrated() &&
          useMatchDayStore.persist.hasHydrated(),
      );
    };

    const unsubscribePlayerStore =
      usePlayerStore.persist.onFinishHydration(updateHydrationState);
    const unsubscribeGameStore =
      useGameStore.persist.onFinishHydration(updateHydrationState);
    const unsubscribeMatchDayStore =
      useMatchDayStore.persist.onFinishHydration(updateHydrationState);

    updateHydrationState();

    return () => {
      unsubscribePlayerStore();
      unsubscribeGameStore();
      unsubscribeMatchDayStore();
    };
  }, []);

  return isHydrated;
}
