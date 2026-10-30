import { useEffect } from 'react';

import { useGameStore } from '../store/gameStore';

export function useRestoreGame(storesHydrated = true) {
  const hydrated = useGameStore((state) => state.hydrated);
  const hydrateGame = useGameStore((state) => state.hydrateGame);
  const syncNow = useGameStore((state) => state.syncNow);

  useEffect(() => {
    if (!storesHydrated) return;
    void hydrateGame().then(() => {
      if (useGameStore.getState().hydrated) void syncNow();
    });
  }, [hydrateGame, syncNow, storesHydrated]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    return useGameStore.subscribe((state, previousState) => {
      const gameStateChanged =
        state.archivedTables !== previousState.archivedTables ||
        state.currentTable !== previousState.currentTable ||
        state.players !== previousState.players ||
        state.rounds !== previousState.rounds ||
        state.balances !== previousState.balances ||
        state.settlements !== previousState.settlements ||
        state.activeGame !== previousState.activeGame;

      if (gameStateChanged) {
        void useGameStore.getState().persistGame();
      }
    });
  }, [hydrated]);

  return {
    restored: hydrated,
    restoring: !hydrated,
  };
}
