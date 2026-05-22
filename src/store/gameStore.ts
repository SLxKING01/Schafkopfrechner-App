import AsyncStorage from '@react-native-async-storage/async-storage';
import * as crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_GAME_TYPE_ID } from '../constants/gameTypes';
import type { CreateGameInput, Game } from '../models/Game';
import { createLocalPlayer } from '../services/game/addPlayer';
import { createGameRound } from '../services/game/createRound';
import {
  createGameTable,
  generateTableHashCode,
} from '../services/game/createTable';
import { finishGameDay as finishGameDayService } from '../services/game/finishGameDay';
import { clearGameState } from '../services/persistence/clearGameState';
import { restoreGameState } from '../services/persistence/restoreGameState';
import { saveGameState } from '../services/persistence/saveGameState';
import { syncGameTable } from '../services/sync/syncGameTable';
import { syncRounds } from '../services/sync/syncRounds';
import { syncSettlements } from '../services/sync/syncSettlements';
import type {
  CreateRoundPayload,
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../types/game';
import { normalizeGameOptions } from '../utils/formatGameOptions';
import {
  areTableOrderIdsEqual,
  sanitizeTableOrderIds,
} from '../utils/tableOrder';
import { useMatchDayStore } from './matchDayStore';

type GameStore = {
  games: Game[];
  currentTable: GameTable | null;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  activeGame: boolean;
  tableOrderIds: string[];
  hydrated: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  isOffline: boolean;
  addGame: (game: CreateGameInput) => boolean;
  updateGame: (updatedGame: Game) => boolean;
  undoLastGame: () => boolean;
  removeGame: (id: string) => void;
  createTable: (name: string, players: Player[]) => boolean;
  addPlayer: (name: string) => boolean;
  removePlayer: (id: string) => void;
  addRound: (round: CreateRoundPayload) => boolean;
  finishGameDay: () => boolean;
  markSettlementPaid: (id: string) => void;
  resetGame: () => void;
  setTableOrderIds: (tableOrderIds: string[]) => void;
  hydrateGame: () => Promise<void>;
  persistGame: () => Promise<void>;
  clearPersistedGame: () => Promise<void>;
  syncNow: () => Promise<void>;
};

function isValidGame(game: Pick<Game, 'winnerId' | 'loserIds' | 'amount'>) {
  return (
    Boolean(game.winnerId) &&
    game.loserIds.length > 0 &&
    Number.isFinite(game.amount) &&
    game.amount > 0 &&
    !game.loserIds.includes(game.winnerId)
  );
}

function calculateMvpBalances(
  players: Player[],
  rounds: GameRound[],
): PlayerBalance[] {
  const centsByPlayer = new Map(players.map((player) => [player.id, 0]));

  rounds.forEach((round) => {
    if (!Number.isFinite(round.amount)) {
      return;
    }

    const amountInCents = Math.round(round.amount * 100);
    const loserCount = round.loserIds.length;

    if (loserCount === 0 || amountInCents <= 0) {
      return;
    }

    centsByPlayer.set(
      round.winnerId,
      (centsByPlayer.get(round.winnerId) ?? 0) + amountInCents,
    );

    const baseLoss = Math.floor(amountInCents / loserCount);
    let remainder = amountInCents % loserCount;

    [...round.loserIds].sort().forEach((loserId) => {
      const extraCent = remainder > 0 ? 1 : 0;
      remainder -= extraCent;
      centsByPlayer.set(
        loserId,
        (centsByPlayer.get(loserId) ?? 0) - baseLoss - extraCent,
      );
    });
  });

  return players.map((player) => ({
    playerId: player.id,
    amount: (centsByPlayer.get(player.id) ?? 0) / 100,
  }));
}

function recalculateGameState(players: Player[], rounds: GameRound[]) {
  const balances = calculateMvpBalances(players, rounds);
  const settlements = finishGameDayService(balances);

  return { balances, settlements };
}

function toPersistedGameState(state: GameStore) {
  return {
    currentTable: state.currentTable,
    players: state.players,
    rounds: state.rounds,
    balances: state.balances,
    settlements: state.settlements,
    activeGame: state.activeGame,
    savedAt: new Date().toISOString(),
    schemaVersion: 1 as const,
  };
}

function normalizeGameTable(table: GameTable | null): GameTable | null {
  if (!table) {
    return null;
  }

  return {
    ...table,
    hashCode: table.hashCode || generateTableHashCode(),
    createdAt: table.createdAt || new Date().toISOString(),
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      games: [],
      currentTable: null,
      players: [],
      rounds: [],
      balances: [],
      settlements: [],
      activeGame: false,
      tableOrderIds: [],
      hydrated: false,
      syncing: false,
      lastSyncedAt: null,
      isOffline: false,
      addGame: (game) => {
        if (!isValidGame(game)) {
          return false;
        }

        const matchDayState = useMatchDayStore.getState();
        const targetMatchDayId =
          game.matchDayId ?? matchDayState.activeMatchDayId ?? undefined;
        const targetMatchDay = matchDayState.matchDays.find(
          (matchDay) => matchDay.id === targetMatchDayId,
        );

        if (targetMatchDay?.isClosed) {
          return false;
        }

        set((state) => ({
          games: [
            ...state.games,
            {
              ...game,
              gameTypeId: game.gameTypeId || DEFAULT_GAME_TYPE_ID,
              options: normalizeGameOptions(game.options),
              matchDayId: targetMatchDayId,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ],
        }));

        return true;
      },
      removeGame: (id) => {
        const matchDayState = useMatchDayStore.getState();

        set((state) => {
          const gameToRemove = state.games.find((game) => game.id === id);
          const targetMatchDayId =
            gameToRemove?.matchDayId ?? matchDayState.activeMatchDayId;
          const targetMatchDay = matchDayState.matchDays.find(
            (matchDay) => matchDay.id === targetMatchDayId,
          );

          if (!gameToRemove || targetMatchDay?.isClosed) {
            return state;
          }

          return {
            games: state.games.filter((game) => game.id !== id),
          };
        });
      },
      updateGame: (updatedGame) => {
        const matchDayState = useMatchDayStore.getState();
        const targetMatchDayId =
          updatedGame.matchDayId ?? matchDayState.activeMatchDayId ?? undefined;
        const targetMatchDay = matchDayState.matchDays.find(
          (matchDay) => matchDay.id === targetMatchDayId,
        );

        if (targetMatchDay?.isClosed || !isValidGame(updatedGame)) {
          return false;
        }

        let didUpdateGame = false;

        set((state) => ({
          games: state.games.map((game) => {
            if (game.id !== updatedGame.id) {
              return game;
            }

            didUpdateGame = true;

            return {
              ...updatedGame,
              gameTypeId: updatedGame.gameTypeId || DEFAULT_GAME_TYPE_ID,
              options: normalizeGameOptions(updatedGame.options),
              matchDayId: targetMatchDayId,
            };
          }),
        }));

        return didUpdateGame;
      },
      undoLastGame: () => {
        const matchDayState = useMatchDayStore.getState();
        const activeMatchDayId = matchDayState.activeMatchDayId;
        const activeMatchDay = matchDayState.matchDays.find(
          (matchDay) => matchDay.id === activeMatchDayId,
        );

        if (!activeMatchDayId || activeMatchDay?.isClosed) {
          return false;
        }

        let didRemoveGame = false;

        set((state) => {
          const lastActiveGame = [...state.games]
            .reverse()
            .find(
              (game) =>
                !game.matchDayId || game.matchDayId === activeMatchDayId,
            );

          if (!lastActiveGame) {
            return state;
          }

          didRemoveGame = true;

          return {
            games: state.games.filter((game) => game.id !== lastActiveGame.id),
          };
        });

        return didRemoveGame;
      },
      createTable: (name, players) => {
        const tableName = name.trim();
        const uniquePlayers = players.filter(
          (player, index, allPlayers) =>
            allPlayers.findIndex(
              (candidate) =>
                candidate.name.trim().toLowerCase() ===
                player.name.trim().toLowerCase(),
            ) === index,
        );

        if (!tableName || uniquePlayers.length < 2) {
          return false;
        }

        set((state) => ({
          currentTable: createGameTable({
            existingHashCodes: state.currentTable?.hashCode
              ? [state.currentTable.hashCode]
              : [],
            name: tableName,
            players: uniquePlayers,
          }),
          players: uniquePlayers,
          rounds: [],
          balances: calculateMvpBalances(uniquePlayers, []),
          settlements: [],
          activeGame: true,
          isOffline: false,
        }));

        return true;
      },
      addPlayer: (name) => {
        const playerName = name.trim();

        if (!playerName) {
          return false;
        }

        let didAdd = false;

        set((state) => {
          const exists = state.players.some(
            (player) =>
              player.name.trim().toLowerCase() === playerName.toLowerCase(),
          );

          if (exists) {
            return state;
          }

          didAdd = true;
          const nextPlayers = [...state.players, createLocalPlayer(playerName)];
          const nextGameState = recalculateGameState(nextPlayers, state.rounds);

          return {
            players: nextPlayers,
            ...nextGameState,
          };
        });

        return didAdd;
      },
      removePlayer: (id) => {
        set((state) => {
          const playerHasRounds = state.rounds.some(
            (round) => round.winnerId === id || round.loserIds.includes(id),
          );

          if (playerHasRounds) {
            return state;
          }

          const nextPlayers = state.players.filter(
            (player) => player.id !== id,
          );
          const nextGameState = recalculateGameState(nextPlayers, state.rounds);

          return {
            players: nextPlayers,
            ...nextGameState,
          };
        });
      },
      addRound: (round) => {
        let didAdd = false;

        set((state) => {
          if (
            !state.currentTable ||
            !state.activeGame ||
            !round.winnerId ||
            round.loserIds.length === 0 ||
            round.loserIds.includes(round.winnerId) ||
            !Number.isFinite(round.amount) ||
            round.amount <= 0
          ) {
            return state;
          }

          const nextRounds = [
            ...state.rounds,
            createGameRound(state.currentTable.id, round),
          ];
          const nextGameState = recalculateGameState(state.players, nextRounds);
          didAdd = true;

          return {
            rounds: nextRounds,
            ...nextGameState,
            isOffline: false,
          };
        });

        return didAdd;
      },
      finishGameDay: () => {
        let didFinish = false;

        set((state) => {
          if (!state.currentTable || !state.activeGame) {
            return state;
          }

          didFinish = true;

          return {
            activeGame: false,
            currentTable: {
              ...state.currentTable,
              isActive: false,
            },
            settlements: finishGameDayService(state.balances),
            isOffline: false,
          };
        });

        return didFinish;
      },
      markSettlementPaid: (id) => {
        set((state) => ({
          settlements: state.settlements.map((settlement) =>
            settlement.id === id ? { ...settlement, isPaid: true } : settlement,
          ),
          isOffline: false,
        }));
      },
      resetGame: () => {
        set({
          currentTable: null,
          players: [],
          rounds: [],
          balances: [],
          settlements: [],
          activeGame: false,
          isOffline: false,
        });
      },
      setTableOrderIds: (tableOrderIds) => {
        const nextTableOrderIds = sanitizeTableOrderIds(tableOrderIds);

        set((state) => {
          if (areTableOrderIdsEqual(state.tableOrderIds, nextTableOrderIds)) {
            return state;
          }

          return { tableOrderIds: nextTableOrderIds };
        });
      },
      hydrateGame: async () => {
        const restoredState = await restoreGameState();

        if (!restoredState) {
          set({ hydrated: true });
          return;
        }

        set({
          currentTable: normalizeGameTable(restoredState.currentTable),
          players: restoredState.players,
          rounds: restoredState.rounds,
          balances: restoredState.balances,
          settlements: restoredState.settlements,
          activeGame: restoredState.activeGame,
          hydrated: true,
        });
      },
      persistGame: async () => {
        await saveGameState(toPersistedGameState(useGameStore.getState()));
      },
      clearPersistedGame: async () => {
        await clearGameState();
        set({ hydrated: true });
      },
      syncNow: async () => {
        set({ syncing: true });

        const state = useGameStore.getState();
        const tableResult = await syncGameTable(
          state.currentTable,
          state.players,
        );
        const roundsResult = await syncRounds(state.rounds);
        const settlementsResult = await syncSettlements(state.settlements);
        const syncedAt =
          settlementsResult.syncedAt ??
          roundsResult.syncedAt ??
          tableResult.syncedAt;

        set({
          syncing: false,
          isOffline:
            tableResult.queued ||
            roundsResult.queued ||
            settlementsResult.queued,
          lastSyncedAt: syncedAt ?? state.lastSyncedAt,
        });
      },
    }),
    {
      name: 'schafkopfrechner-games',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        games: state.games,
        currentTable: state.currentTable,
        players: state.players,
        rounds: state.rounds,
        balances: state.balances,
        settlements: state.settlements,
        activeGame: state.activeGame,
        tableOrderIds: state.tableOrderIds,
        lastSyncedAt: state.lastSyncedAt,
        isOffline: state.isOffline,
      }),
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState;
        }

        const nextState = {
          ...currentState,
          ...(persistedState as Partial<GameStore>),
        };

        return {
          ...nextState,
          tableOrderIds: sanitizeTableOrderIds(nextState.tableOrderIds),
        };
      },
    },
  ),
);
