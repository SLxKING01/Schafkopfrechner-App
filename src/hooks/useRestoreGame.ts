import { useEffect } from 'react';

import { useGameStore } from '../store/gameStore';

export function useRestoreGame() {
  const hydrated = useGameStore((state) => state.hydrated);
  const hydrateGame = useGameStore((state) => state.hydrateGame);
  const syncNow = useGameStore((state) => state.syncNow);

  useEffect(() => {
    void hydrateGame().then(() => {
      void syncNow();
    });
  }, [hydrateGame, syncNow]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    return useGameStore.subscribe((state, previousState) => {
      const gameStateChanged =
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
