import * as crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_GAME_TYPE_ID } from '../constants/gameTypes';
import { normalizeTableSettings } from '../constants/tableSettings';
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
import {
  GAME_STORE_KEY,
  gameStorageAdapter,
  useStorageStatus,
  writeGameStorage,
} from '../storage/durableGameStorage';
import type {
  ArchivedTable,
  CreateRoundPayload,
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
  TableSettings,
} from '../types/game';
import { normalizeGameOptions } from '../utils/formatGameOptions';
import {
  areTableOrderIdsEqual,
  sanitizeTableOrderIds,
} from '../utils/tableOrder';
import { partyBalances, validParties, winningIds } from '../utils/winningParty';
import { useMatchDayStore } from './matchDayStore';
import { usePlayerStore } from './playerStore';

type GameStore = {
  games: Game[];
  archivedTables: ArchivedTable[];
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
  createTable: (
    name: string,
    players: Player[],
    settings?: TableSettings,
  ) => Promise<boolean>;
  addPlayer: (name: string) => boolean;
  removePlayer: (id: string) => void;
  addRound: (round: CreateRoundPayload) => boolean;
  finishGameDay: () => boolean;
  markSettlementPaid: (id: string, tableId?: string) => void;
  resetGame: () => Promise<boolean>;
  updateRound: (id: string, round: CreateRoundPayload) => boolean;
  setTableOrderIds: (tableOrderIds: string[]) => void;
  updateCurrentTableSettings: (settings: TableSettings) => boolean;
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
  return partyBalances(
    players,
    rounds.map((round) => ({ ...round, loserIds: [...round.loserIds].sort() })),
  );
}

function recalculateGameState(players: Player[], rounds: GameRound[]) {
  const balances = calculateMvpBalances(players, rounds);
  const settlements = finishGameDayService(balances);

  return { balances, settlements };
}

function repairLedger<
  T extends {
    players: Player[];
    rounds: GameRound[];
    balances: PlayerBalance[];
    settlements: Settlement[];
  },
>(entry: T): T {
  if (!entry.rounds.length) return entry;
  const balances = calculateMvpBalances(entry.players, entry.rounds);
  const recordedIds = new Set(
    entry.balances.map((balance) => balance.playerId),
  );
  const missingBalance = entry.rounds.some((round) =>
    [...winningIds(round), ...round.loserIds].some(
      (id) => !recordedIds.has(id),
    ),
  );
  const unbalanced =
    entry.balances.reduce(
      (sum, balance) => sum + Math.round(balance.amount * 100),
      0,
    ) !== 0;
  // Repair lost references only; do not rewrite balanced historical results to a new interpretation.
  if (!missingBalance && !unbalanced) return entry;
  const settlements = finishGameDayService(balances).map((payment) => ({
    ...payment,
    isPaid: entry.settlements.some(
      (old) =>
        old.id === payment.id && old.amount === payment.amount && old.isPaid,
    ),
  }));
  return { ...entry, balances, settlements };
}

function archiveCurrentTable(state: GameStore): ArchivedTable[] {
  if (!state.currentTable) return state.archivedTables;
  return [
    ...state.archivedTables.filter(
      (entry) => entry.currentTable.id !== state.currentTable!.id,
    ),
    {
      currentTable: { ...state.currentTable, isActive: false },
      players: state.players,
      rounds: state.rounds,
      balances: state.balances,
      settlements: state.settlements,
      archivedAt: new Date().toISOString(),
    },
  ];
}

function persistedFields(state: GameStore) {
  return {
    archivedTables: state.archivedTables,
    games: state.games,
    currentTable: state.currentTable,
    players: state.players,
    rounds: state.rounds,
    balances: state.balances,
    settlements: state.settlements,
    activeGame: state.activeGame,
    tableOrderIds: state.tableOrderIds,
    lastSyncedAt: null,
    isOffline: true,
  };
}

async function commitTableTransition(
  changes: Partial<GameStore>,
): Promise<boolean> {
  if (useStorageStatus.getState().busy) return false;
  useStorageStatus.setState({ busy: true });
  try {
    const next = { ...useGameStore.getState(), ...changes };
    await writeGameStorage(
      GAME_STORE_KEY,
      JSON.stringify({ state: persistedFields(next), version: 0 }),
    );
    useGameStore.setState(changes);
    return true;
  } catch {
    return false;
  } finally {
    useStorageStatus.setState({ busy: false });
  }
}

function normalizeGameTable(table: GameTable | null): GameTable | null {
  if (!table) {
    return null;
  }

  return {
    ...table,
    hashCode: table.hashCode || generateTableHashCode(),
    createdAt: table.createdAt || new Date().toISOString(),
    settings: normalizeTableSettings(table.settings),
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      games: [],
      archivedTables: [],
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
        if (useStorageStatus.getState().busy) return false;
        if (
          !isValidGame(game) ||
          !validParties(
            game,
            usePlayerStore.getState().players,
            game.gameTypeId,
          )
        ) {
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
              participantNames: Object.fromEntries(
                usePlayerStore
                  .getState()
                  .players.map((player) => [player.id, player.name]),
              ),
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
        if (useStorageStatus.getState().busy) return undefined;
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
        if (useStorageStatus.getState().busy) return false;
        const matchDayState = useMatchDayStore.getState();
        const targetMatchDayId =
          updatedGame.matchDayId ?? matchDayState.activeMatchDayId ?? undefined;
        const targetMatchDay = matchDayState.matchDays.find(
          (matchDay) => matchDay.id === targetMatchDayId,
        );

        if (
          targetMatchDay?.isClosed ||
          !isValidGame(updatedGame) ||
          !validParties(
            updatedGame,
            usePlayerStore.getState().players,
            updatedGame.gameTypeId,
            get().games.find((game) => game.id === updatedGame.id),
          )
        ) {
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
              participantNames: {
                ...Object.fromEntries(
                  usePlayerStore
                    .getState()
                    .players.map((player) => [player.id, player.name]),
                ),
                ...game.participantNames,
              },
              gameTypeId: updatedGame.gameTypeId || DEFAULT_GAME_TYPE_ID,
              options: normalizeGameOptions(updatedGame.options),
              matchDayId: targetMatchDayId,
            };
          }),
        }));

        return didUpdateGame;
      },
      undoLastGame: () => {
        if (useStorageStatus.getState().busy) return false;
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
      createTable: async (name, players, settings): Promise<boolean> => {
        if (useStorageStatus.getState().busy) return false;
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

        const state = get();
        return commitTableTransition({
          archivedTables: archiveCurrentTable(state),
          currentTable: createGameTable({
            existingHashCodes: state.currentTable?.hashCode
              ? [
                  state.currentTable.hashCode,
                  ...state.archivedTables.map(
                    (entry) => entry.currentTable.hashCode,
                  ),
                ]
              : state.archivedTables.map(
                  (entry) => entry.currentTable.hashCode,
                ),
            name: tableName,
            players: uniquePlayers,
            settings,
          }),
          players: uniquePlayers,
          rounds: [],
          balances: calculateMvpBalances(uniquePlayers, []),
          settlements: [],
          activeGame: true,
          isOffline: false,
        });
      },
      addPlayer: (name) => {
        if (useStorageStatus.getState().busy) return false;
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
        if (useStorageStatus.getState().busy) return undefined;
        set((state) => {
          const playerHasRounds = state.rounds.some(
            (round) =>
              winningIds(round).includes(id) || round.loserIds.includes(id),
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
        if (useStorageStatus.getState().busy) return false;
        let didAdd = false;

        set((state) => {
          if (
            !state.currentTable ||
            !state.activeGame ||
            !validParties(round, state.players, round.gameType) ||
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
            createGameRound(state.currentTable.id, {
              ...round,
              settingsSnapshot: state.currentTable.settings,
            }),
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
      updateRound: (id, round) => {
        const state = get();
        const original = state.rounds.find((entry) => entry.id === id);
        if (
          useStorageStatus.getState().busy ||
          !state.activeGame ||
          !original ||
          !validParties(round, state.players, round.gameType, original)
        )
          return false;
        const rounds = state.rounds.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...round,
                settingsSnapshot: original.settingsSnapshot,
              }
            : entry,
        );
        set({ rounds, ...recalculateGameState(state.players, rounds) });
        return true;
      },
      finishGameDay: () => {
        if (useStorageStatus.getState().busy) return false;
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
      markSettlementPaid: (id, tableId) => {
        if (useStorageStatus.getState().busy) return undefined;
        set((state) => {
          if (!tableId && state.activeGame) return state;
          return {
            archivedTables: tableId
              ? state.archivedTables.map((entry) =>
                  entry.currentTable.id === tableId
                    ? {
                        ...entry,
                        settlements: entry.settlements.map((settlement) =>
                          settlement.id === id
                            ? { ...settlement, isPaid: true }
                            : settlement,
                        ),
                      }
                    : entry,
                )
              : state.archivedTables,
            settlements: tableId
              ? state.settlements
              : state.settlements.map((settlement) =>
                  settlement.id === id
                    ? { ...settlement, isPaid: true }
                    : settlement,
                ),
            isOffline: false,
          };
        });
      },
      resetGame: async (): Promise<boolean> => {
        if (useStorageStatus.getState().busy) return false;
        return commitTableTransition({
          archivedTables: archiveCurrentTable(get()),
          currentTable: null,
          players: [],
          rounds: [],
          balances: [],
          settlements: [],
          activeGame: false,
          isOffline: true,
        });
      },
      setTableOrderIds: (tableOrderIds) => {
        if (useStorageStatus.getState().busy) return undefined;
        const nextTableOrderIds = sanitizeTableOrderIds(tableOrderIds);

        set((state) => {
          if (areTableOrderIdsEqual(state.tableOrderIds, nextTableOrderIds)) {
            return state;
          }

          return { tableOrderIds: nextTableOrderIds };
        });
      },
      updateCurrentTableSettings: (settings) => {
        if (useStorageStatus.getState().busy) return false;
        let didUpdate = false;

        set((state) => {
          if (!state.currentTable) {
            return state;
          }

          didUpdate = true;

          return {
            currentTable: {
              ...state.currentTable,
              settings: normalizeTableSettings(settings),
            },
            isOffline: false,
          };
        });

        return didUpdate;
      },
      hydrateGame: async (): Promise<void> => {
        try {
          const primary = await gameStorageAdapter.getItem(GAME_STORE_KEY);
          if (primary) {
            await useGameStore.persist.rehydrate();
          } else {
            // One-time import of the old secondary backup. Never overwrite the newer canonical store.
            const restored = await restoreGameState();
            if (restored)
              set({
                ...restored,
                currentTable: normalizeGameTable(restored.currentTable),
                archivedTables: restored.archivedTables ?? [],
              });
          }
          set({ hydrated: true });
        } catch {
          useStorageStatus.setState({
            error:
              'Spielstand konnte nicht geladen werden. Bitte die App offen lassen und erneut versuchen.',
          });
        }
      },
      persistGame: async (): Promise<void> => {
        await writeGameStorage(
          GAME_STORE_KEY,
          JSON.stringify({ state: persistedFields(get()), version: 0 }),
        ).catch(() => undefined);
      },
      clearPersistedGame: async () => {
        await clearGameState();
        set({ hydrated: true });
      },
      syncNow: async () => {
        // This branch has no implemented cloud transport. Never report a stub as a cloud save.
        set({ syncing: false, lastSyncedAt: null, isOffline: true });
      },
    }),
    {
      name: 'schafkopfrechner-games',
      storage: createJSONStorage(() => gameStorageAdapter),
      partialize: persistedFields,
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState;
        }

        const nextState = {
          ...currentState,
          ...(persistedState as Partial<GameStore>),
        };

        return {
          ...repairLedger(nextState),
          archivedTables: nextState.archivedTables.map(repairLedger),
          tableOrderIds: sanitizeTableOrderIds(nextState.tableOrderIds),
        };
      },
    },
  ),
);
