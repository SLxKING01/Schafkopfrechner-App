import { useEffect, useState, useSyncExternalStore } from 'react';

import { recoverPendingSyncRestore } from '../services/sync/syncGameState';
import {
  getStorageIssues,
  subscribeStorageIssues,
} from '../storage/reliableStorage';
import { useGameStore } from '../store/gameStore';

export function useRestoreGame(storesHydrated = true) {
  const hydrated = useGameStore((state) => state.hydrated);
  const hydrateGame = useGameStore((state) => state.hydrateGame);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const issues = useSyncExternalStore(
    subscribeStorageIssues,
    getStorageIssues,
    getStorageIssues,
  );
  const recoveryIssues = recoveryReady ? null : issues;

  useEffect(() => {
    if (recoveryReady) return;
    let disposed = false;
    if (storesHydrated)
      void (async () => {
        try {
          await recoverPendingSyncRestore();
          await hydrateGame();
          if (!disposed) setRecoveryReady(true);
        } catch (error) {
          useGameStore.setState({
            syncError:
              error instanceof Error
                ? error.message
                : 'Wiederherstellung aus der lokalen Sicherung fehlgeschlagen.',
          });
        }
      })();
    return () => {
      disposed = true;
    };
  }, [hydrateGame, storesHydrated, recoveryReady, recoveryIssues]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    return useGameStore.subscribe((state, previousState) => {
      const gameStateChanged =
        state.archivedGameDays !== previousState.archivedGameDays ||
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
    restored: hydrated && recoveryReady,
    restoring: !hydrated || !recoveryReady,
  };
}
