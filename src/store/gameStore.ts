import * as crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_GAME_TYPE_ID } from '../constants/gameTypes';
import {
  getGameRules,
  normalizeTableSettings,
} from '../constants/tableSettings';
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
import { syncGameState } from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import { normalizeRestoredTables } from '../storage/validateGameState';
import type {
  ArchivedGameDay,
  CreateRoundPayload,
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
  TableSettings,
} from '../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
  hasUniquePlayerIds,
  isValidRound,
  roundWinnerIds,
  toSafeCents,
} from '../utils/accounting';
import { getCurrentDealerId, getNextDealerId } from '../utils/dealerOrder';
import { normalizeGameOptions } from '../utils/formatGameOptions';
import {
  archiveFinishedGameDay,
  mergeGameDayArchives,
} from '../utils/gameDayArchive';
import {
  calculatePartyAmount,
  calculateRoundTariff,
  isValidRoundMetadata,
} from '../utils/roundTariff';
import {
  areTableOrderIdsEqual,
  sanitizeTableOrderIds,
} from '../utils/tableOrder';
import { useMatchDayStore } from './matchDayStore';
import { usePlayerStore } from './playerStore';

type GameStore = {
  games: Game[];
  archivedGameDays: ArchivedGameDay[];
  currentTable: GameTable | null;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  activeGame: boolean;
  tableOrderIds: string[];
  hydrated: boolean;
  localStateRestored: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  cloudOwnerId: string | null;
  cloudVersion: number | null;
  cloudBaseline: string | null;
  isOffline: boolean;
  addGame: (game: CreateGameInput) => boolean;
  updateGame: (updatedGame: Game) => boolean;
  undoLastGame: () => boolean;
  removeGame: (id: string) => void;
  createTable: (
    name: string,
    players: Player[],
    settings?: TableSettings,
  ) => boolean;
  setPlayerOrder: (playerIds: string[]) => boolean;
  setTurboRamsch: (enabled: boolean) => void;
  togglePlayerLeger: (playerId: string) => void;
  addPlayer: (name: string) => boolean;
  removePlayer: (id: string) => void;
  addRound: (round: CreateRoundPayload) => boolean;
  updateRound: (id: string, round: CreateRoundPayload) => boolean;
  undoLastRound: () => boolean;
  finishGameDay: (stockResolution?: 'refund' | 'carry') => boolean;
  markSettlementPaid: (id: string, isPaid?: boolean, tableId?: string) => void;
  resetGame: () => void;
  setTableOrderIds: (tableOrderIds: string[]) => void;
  updateCurrentTableSettings: (settings: TableSettings) => boolean;
  hydrateGame: () => Promise<void>;
  persistGame: () => Promise<void>;
  clearPersistedGame: () => Promise<void>;
  syncNow: () => Promise<void>;
};

function calculateMvpBalances(
  players: Player[],
  rounds: GameRound[],
): PlayerBalance[] {
  return calculateRoundBalances(players, rounds, 'id');
}

function isSafeSavedDay(
  games: (Game | CreateGameInput)[],
  matchDayId: string,
  activeDayId: string | null,
) {
  try {
    calculateRoundBalances(
      usePlayerStore.getState().players,
      games.filter((game) => (game.matchDayId ?? activeDayId) === matchDayId),
    );
    return true;
  } catch {
    return false;
  }
}

function recalculateGameState(players: Player[], rounds: GameRound[]) {
  const balances = calculateMvpBalances(players, rounds);
  const settlements =
    getStockBalanceCents(rounds) > 0 ? [] : finishGameDayService(balances);

  return { balances, settlements };
}

function toPersistedGameState(state: GameStore) {
  return {
    cloudOwnerId: state.cloudOwnerId,
    cloudVersion: state.cloudVersion,
    cloudBaseline: state.cloudBaseline,
    archivedGameDays: state.archivedGameDays,
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
    settings: normalizeTableSettings(table.settings),
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      games: [],
      archivedGameDays: [],
      currentTable: null,
      players: [],
      rounds: [],
      balances: [],
      settlements: [],
      activeGame: false,
      tableOrderIds: [],
      hydrated: false,
      localStateRestored: false,
      syncing: false,
      lastSyncedAt: null,
      syncError: null,
      cloudOwnerId: null,
      cloudVersion: null,
      cloudBaseline: null,
      isOffline: false,
      addGame: (game) => {
        if (!isValidRound(game, usePlayerStore.getState().players)) {
          return false;
        }

        const matchDayState = useMatchDayStore.getState();
        const targetMatchDayId =
          game.matchDayId ?? matchDayState.activeMatchDayId ?? undefined;
        const targetMatchDay = matchDayState.matchDays.find(
          (matchDay) => matchDay.id === targetMatchDayId,
        );

        if (!targetMatchDay || targetMatchDay.isClosed) {
          return false;
        }

        if (
          !isSafeSavedDay(
            [
              ...useGameStore.getState().games,
              { ...game, matchDayId: targetMatchDayId },
            ],
            targetMatchDay.id,
            matchDayState.activeMatchDayId,
          )
        )
          return false;
        set((state) => ({
          games: [
            ...state.games,
            {
              ...game,
              loserIds: [...game.loserIds],
              amount: toSafeCents(game.amount)! / 100,
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

          if (!gameToRemove || !targetMatchDay || targetMatchDay.isClosed) {
            return state;
          }

          const nextGames = state.games.filter((game) => game.id !== id);
          if (
            !isSafeSavedDay(
              nextGames,
              targetMatchDay.id,
              matchDayState.activeMatchDayId,
            )
          )
            return state;
          return { games: nextGames };
        });
      },
      updateGame: (updatedGame) => {
        const matchDayState = useMatchDayStore.getState();
        const targetMatchDayId =
          updatedGame.matchDayId ?? matchDayState.activeMatchDayId ?? undefined;
        const targetMatchDay = matchDayState.matchDays.find(
          (matchDay) => matchDay.id === targetMatchDayId,
        );

        const original = useGameStore
          .getState()
          .games.find(({ id }) => id === updatedGame.id);
        const sourceDay = matchDayState.matchDays.find(
          ({ id }) =>
            id === (original?.matchDayId ?? matchDayState.activeMatchDayId),
        );
        if (
          !original ||
          !sourceDay ||
          sourceDay.isClosed ||
          !targetMatchDay ||
          targetMatchDay.isClosed ||
          !isValidRound(updatedGame, usePlayerStore.getState().players)
        )
          return false;

        const candidateGames = useGameStore
          .getState()
          .games.map((game) =>
            game.id === updatedGame.id
              ? { ...updatedGame, matchDayId: targetMatchDayId }
              : game,
          );
        if (
          ![sourceDay.id, targetMatchDay.id].every((id) =>
            isSafeSavedDay(candidateGames, id, matchDayState.activeMatchDayId),
          )
        )
          return false;
        let didUpdateGame = false;

        set((state) => ({
          games: state.games.map((game) => {
            if (game.id !== updatedGame.id) {
              return game;
            }

            didUpdateGame = true;

            return {
              ...updatedGame,
              id: game.id,
              createdAt: game.createdAt,
              loserIds: [...updatedGame.loserIds],
              amount: toSafeCents(updatedGame.amount)! / 100,
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

        if (!activeMatchDayId || !activeMatchDay || activeMatchDay.isClosed) {
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
      createTable: (name, players, settings) => {
        const tableName = name.trim();
        const uniquePlayers = players.filter(
          (player, index, allPlayers) =>
            allPlayers.findIndex(
              (candidate) =>
                candidate.name.trim().toLowerCase() ===
                player.name.trim().toLowerCase(),
            ) === index,
        );

        if (
          !tableName ||
          uniquePlayers.length < 2 ||
          !hasUniquePlayerIds(players) ||
          players.some((player) => !player.name.trim())
        ) {
          return false;
        }

        if (
          useGameStore.getState().activeGame &&
          useGameStore.getState().currentTable
        )
          return false;
        set((state) => ({
          archivedGameDays: archiveFinishedGameDay(
            state.archivedGameDays,
            state,
          ),
          currentTable: createGameTable({
            existingHashCodes: state.currentTable?.hashCode
              ? [state.currentTable.hashCode]
              : [],
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
        }));

        return true;
      },
      togglePlayerLeger: (playerId) => {
        set((state) => {
          if (
            !state.currentTable ||
            !state.activeGame ||
            !state.currentTable.isActive ||
            !state.currentTable.settings.bonusRules.leger.enabled ||
            !state.players.some((player) => player.id === playerId)
          )
            return state;
          const placed = state.currentTable.placedLegerPlayerIds ?? [];
          if (!placed.includes(playerId) && placed.length >= 4) return state;
          return {
            currentTable: {
              ...state.currentTable,
              placedLegerPlayerIds: placed.includes(playerId)
                ? placed.filter((id) => id !== playerId)
                : [...placed, playerId],
            },
          };
        });
      },
      setTurboRamsch: (enabled) => {
        set((state) =>
          state.currentTable && state.currentTable.isActive && state.activeGame
            ? {
                currentTable: {
                  ...state.currentTable,
                  turboRamschEnabled: enabled,
                },
              }
            : state,
        );
      },
      setPlayerOrder: (playerIds) => {
        let didUpdate = false;
        set((state) => {
          if (
            !state.currentTable ||
            !state.currentTable.isActive ||
            !state.activeGame ||
            playerIds.length !== state.players.length ||
            new Set(playerIds).size !== state.players.length
          )
            return state;
          const byId = new Map(
            state.players.map((player) => [player.id, player]),
          );
          if (playerIds.some((id) => !byId.has(id))) return state;
          const dealerId = getCurrentDealerId(
            state.currentTable,
            state.players,
            state.rounds.length,
          );
          didUpdate = true;
          return {
            players: playerIds.map((id) => byId.get(id)!),
            currentTable: {
              ...state.currentTable,
              dealerId: dealerId ?? undefined,
            },
          };
        });
        return didUpdate;
      },
      addPlayer: (name) => {
        const playerName = name.trim();

        if (!playerName) {
          return false;
        }

        let didAdd = false;

        set((state) => {
          if (
            state.currentTable &&
            (!state.activeGame || !state.currentTable.isActive)
          )
            return state;
          const exists = state.players.some(
            (player) =>
              player.name.trim().toLowerCase() === playerName.toLowerCase(),
          );

          if (exists) {
            return state;
          }

          const nextPlayers = [...state.players, createLocalPlayer(playerName)];
          let nextGameState;
          try {
            nextGameState = recalculateGameState(nextPlayers, state.rounds);
          } catch {
            return state;
          }
          didAdd = true;

          return {
            players: nextPlayers,
            ...nextGameState,
          };
        });

        return didAdd;
      },
      removePlayer: (id) => {
        set((state) => {
          if (
            state.currentTable &&
            (!state.activeGame || !state.currentTable.isActive)
          )
            return state;
          const playerHasRounds = state.rounds.some(
            (round) =>
              roundWinnerIds(round).includes(id) || round.loserIds.includes(id),
          );

          if (playerHasRounds) {
            return state;
          }

          const nextPlayers = state.players.filter(
            (player) => player.id !== id,
          );
          let nextGameState;
          try {
            nextGameState = recalculateGameState(nextPlayers, state.rounds);
          } catch {
            return state;
          }

          return {
            players: nextPlayers,
            currentTable: state.currentTable
              ? {
                  ...state.currentTable,
                  placedLegerPlayerIds: (
                    state.currentTable.placedLegerPlayerIds ?? []
                  ).filter((playerId) => playerId !== id),
                }
              : null,
            ...nextGameState,
          };
        });
      },
      addRound: (round) => {
        if (
          round.stockAction &&
          !['deposit', 'payout'].includes(round.stockAction)
        )
          return false;
        let didAdd = false;

        set((state) => {
          if (
            !state.currentTable ||
            !state.currentTable.isActive ||
            !state.activeGame ||
            !isValidRound(round, state.players)
          ) {
            return state;
          }

          if (round.tariffOptions) {
            try {
              const options = round.tariffOptions;
              const expectedLeger =
                state.currentTable.settings.bonusRules.leger.enabled &&
                getGameRules(state.currentTable.settings, round.gameType)
                  .bonuses.leger
                  ? Math.min(
                      4,
                      state.currentTable.placedLegerPlayerIds?.length ?? 0,
                    )
                  : 0;
              if (
                options.legerCount !== expectedLeger ||
                options.turboRamsch !==
                  (state.currentTable.turboRamschEnabled ?? false)
              )
                return state;
              const tariff = calculateRoundTariff(
                state.currentTable.settings,
                round.gameType,
                options,
              );
              const party = calculatePartyAmount(
                tariff.totalCents,
                round.gameType,
                roundWinnerIds(round).length,
                round.loserIds.length,
                state.currentTable.settings.gameRules ||
                  options.durchmarsch !== undefined ||
                  options.jungfrauen !== undefined
                  ? options
                  : undefined,
              );
              if (toSafeCents(round.amount) !== party.totalCents) return state;
            } catch {
              return state;
            }
          }
          const created = createGameRound(state.currentTable.id, {
            ...round,
            amount: toSafeCents(round.amount)! / 100,
            settingsSnapshot: state.currentTable.settings,
          });
          if (!isValidRoundMetadata(created)) return state;
          created.roundContext = {
            completesDeal:
              round.stockAction !== 'deposit' ||
              round.stockCompletesDeal !== false,
            dealerIdBefore: getCurrentDealerId(
              state.currentTable,
              state.players,
              state.rounds.length,
            )!,
            legerPlayerIds: [
              ...(state.currentTable.placedLegerPlayerIds ?? []),
            ],
            turboRamsch: state.currentTable.turboRamschEnabled ?? false,
          };
          const nextRounds = [...state.rounds, created];
          let nextGameState;
          try {
            nextGameState = recalculateGameState(state.players, nextRounds);
          } catch {
            return state;
          }
          didAdd = true;

          return {
            rounds: nextRounds,
            currentTable: {
              ...state.currentTable,
              placedLegerPlayerIds:
                round.stockAction !== 'deposit' ||
                round.stockCompletesDeal !== false
                  ? []
                  : state.currentTable.placedLegerPlayerIds,
              dealerId:
                round.stockAction !== 'deposit' ||
                round.stockCompletesDeal !== false
                  ? (getNextDealerId(
                      state.currentTable,
                      state.players,
                      state.rounds.length,
                    ) ?? undefined)
                  : created.roundContext.dealerIdBefore,
            },
            ...nextGameState,
            isOffline: false,
          };
        });

        return didAdd;
      },
      updateRound: (id, payload) => {
        const state = useGameStore.getState();
        if (
          !state.activeGame ||
          !state.currentTable?.isActive ||
          !isValidRound(payload, state.players)
        )
          return false;
        const original = state.rounds.find((round) => round.id === id);
        if (!original) return false;
        if (
          original.stockAction === 'deposit' &&
          payload.stockAction === 'deposit' &&
          (original.stockCompletesDeal ?? true) !==
            (payload.stockCompletesDeal ?? true)
        )
          return false;
        if (
          original.declarerId &&
          ['rufspiel', 'sauspiel'].includes(payload.gameType) &&
          (!payload.declarerId || !payload.partnerId)
        )
          return false;
        if (
          (original.stockAction &&
            !['deposit', 'payout'].includes(original.stockAction)) ||
          (payload.stockAction &&
            !['deposit', 'payout'].includes(payload.stockAction))
        )
          return false;
        try {
          if (
            payload.legerPlayerIds !== undefined &&
            (!original.roundContext ||
              !payload.tariffOptions ||
              !Array.isArray(payload.legerPlayerIds) ||
              payload.legerPlayerIds.length > 4 ||
              new Set(payload.legerPlayerIds).size !==
                payload.legerPlayerIds.length ||
              !payload.legerPlayerIds.every((playerId) =>
                state.players.some(({ id }) => id === playerId),
              ))
          )
            return false;
          if (payload.tariffOptions) {
            const options = payload.tariffOptions;
            if (
              options.legerCount !==
                (original.settingsSnapshot.bonusRules.leger.enabled &&
                getGameRules(original.settingsSnapshot, payload.gameType)
                  .bonuses.leger
                  ? (payload.legerPlayerIds?.length ??
                    original.tariffOptions?.legerCount ??
                    0)
                  : 0) ||
              options.turboRamsch !==
                (original.tariffOptions?.turboRamsch ?? false)
            )
              return false;
            const tariff = calculateRoundTariff(
              original.settingsSnapshot,
              payload.gameType,
              options,
            );
            if (
              calculatePartyAmount(
                tariff.totalCents,
                payload.gameType,
                roundWinnerIds(payload).length,
                payload.loserIds.length,
                original.settingsSnapshot.gameRules ||
                  options.durchmarsch !== undefined ||
                  options.jungfrauen !== undefined
                  ? options
                  : undefined,
              ).totalCents !== toSafeCents(payload.amount)
            )
              return false;
          }
          const changed: GameRound = {
            ...original,
            ...(payload.legerPlayerIds && original.roundContext
              ? {
                  roundContext: {
                    ...original.roundContext,
                    legerPlayerIds: [...payload.legerPlayerIds],
                  },
                }
              : {}),
            winnerId: payload.winnerId,
            winnerIds: payload.winnerIds ? [...payload.winnerIds] : undefined,
            loserIds: [...payload.loserIds],
            amount: toSafeCents(payload.amount)! / 100,
            gameType: payload.gameType,
            suit: payload.suit,
            stockAction: payload.stockAction,
            stockCompletesDeal: payload.stockCompletesDeal,
            declarerId: payload.declarerId,
            partnerId: payload.partnerId,
            tariffOptions: payload.tariffOptions
              ? { ...payload.tariffOptions }
              : undefined,
            updatedAt: new Date().toISOString(),
          };
          if (!isValidRoundMetadata(changed)) return false;
          const nextRounds = state.rounds.map((round) =>
            round.id === id ? changed : round,
          );
          const calculated = recalculateGameState(state.players, nextRounds);
          set({ rounds: nextRounds, ...calculated, isOffline: false });
          return true;
        } catch {
          return false;
        }
      },
      undoLastRound: () => {
        const state = useGameStore.getState();
        if (
          !state.activeGame ||
          !state.currentTable?.isActive ||
          !state.rounds.length
        )
          return false;
        const last = state.rounds[state.rounds.length - 1];
        if (last.stockAction === 'carryIn') return false;
        try {
          const nextRounds = state.rounds.slice(0, -1);
          const calculated = recalculateGameState(state.players, nextRounds);
          const context = last.roundContext;
          if (
            context?.completesDeal === false ||
            (last.stockAction === 'deposit' &&
              last.stockCompletesDeal === false)
          ) {
            set({ rounds: nextRounds, ...calculated, isOffline: false });
            return true;
          }
          const currentDealer = getCurrentDealerId(
            state.currentTable,
            state.players,
            state.rounds.length,
          );
          const index = state.players.findIndex(
            (player) => player.id === currentDealer,
          );
          const previousDealer =
            state.players[
              (index - 1 + state.players.length) % state.players.length
            ]?.id;
          const validIds = new Set(state.players.map((player) => player.id));
          set({
            rounds: nextRounds,
            ...calculated,
            currentTable: {
              ...state.currentTable,
              dealerId:
                context && validIds.has(context.dealerIdBefore)
                  ? context.dealerIdBefore
                  : previousDealer,
              ...(context
                ? {
                    placedLegerPlayerIds: context.legerPlayerIds.filter((id) =>
                      validIds.has(id),
                    ),
                    turboRamschEnabled: context.turboRamsch,
                  }
                : {}),
            },
            isOffline: false,
          });
          return true;
        } catch {
          return false;
        }
      },
      finishGameDay: (stockResolution) => {
        let didFinish = false;
        set((state) => {
          if (
            !state.currentTable ||
            !state.currentTable.isActive ||
            !state.activeGame
          )
            return state;
          let calculated;
          let closingRounds = state.rounds;
          let carryTable: GameTable | null = null;
          let carryRounds: GameRound[] = [];
          try {
            const pot = getStockBalanceCents(state.rounds);
            if (pot > 0) {
              if (stockResolution !== 'refund' && stockResolution !== 'carry')
                return state;
              const closing = createGameRound(state.currentTable.id, {
                winnerId: '',
                winnerIds: [],
                loserIds: state.players.map(({ id }) => id),
                gameType: 'stock',
                amount: pot / 100,
                stockAction:
                  stockResolution === 'carry' ? 'carryOut' : 'refund',
                settingsSnapshot: state.currentTable.settings,
              });
              closingRounds = [...state.rounds, closing];
              if (stockResolution === 'carry') {
                carryTable = createGameTable({
                  name: `${state.currentTable.name} · Fortsetzung`,
                  players: state.players,
                  settings: state.currentTable.settings,
                  existingHashCodes: [state.currentTable.hashCode],
                });
                carryTable.dealerId = state.currentTable.dealerId;
                carryRounds = [
                  createGameRound(carryTable.id, {
                    winnerId: '',
                    winnerIds: [],
                    loserIds: state.players.map(({ id }) => id),
                    gameType: 'stock',
                    amount: pot / 100,
                    stockAction: 'carryIn',
                    settingsSnapshot: carryTable.settings,
                  }),
                ];
              }
            }
            calculated = recalculateGameState(state.players, closingRounds);
            if (carryTable) recalculateGameState(state.players, carryRounds);
          } catch {
            return state;
          }
          const closed = {
            ...state,
            ...calculated,
            rounds: closingRounds,
            activeGame: false,
            currentTable: { ...state.currentTable, isActive: false },
          };
          didFinish = true;
          return {
            ...closed,
            archivedGameDays: archiveFinishedGameDay(
              state.archivedGameDays,
              closed,
              new Date().toISOString(),
            ),
            ...(carryTable
              ? {
                  currentTable: carryTable,
                  rounds: carryRounds,
                  activeGame: true,
                  ...recalculateGameState(state.players, carryRounds),
                }
              : {}),
            isOffline: false,
          };
        });
        return didFinish;
      },
      markSettlementPaid: (id, isPaid = true, tableId) => {
        set((state) => {
          const targetId = tableId ?? state.currentTable?.id;
          if (!targetId) return state;
          const mark = (payments: Settlement[]) =>
            payments.map((payment) =>
              payment.id === id ? { ...payment, isPaid } : payment,
            );
          return {
            settlements:
              state.currentTable?.id === targetId
                ? mark(state.settlements)
                : state.settlements,
            archivedGameDays: state.archivedGameDays.map((day) =>
              day.table.id === targetId
                ? { ...day, settlements: mark(day.settlements) }
                : day,
            ),
            isOffline: false,
          };
        });
      },
      resetGame: () => {
        set((state) => {
          // Reset only prepares a new table; never discard an open evening.
          if (state.currentTable && state.activeGame) return state;
          return {
            archivedGameDays: archiveFinishedGameDay(
              state.archivedGameDays,
              state,
            ),
            currentTable: null,
            players: [],
            rounds: [],
            balances: [],
            settlements: [],
            activeGame: false,
            isOffline: false,
          };
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
      updateCurrentTableSettings: (settings) => {
        let didUpdate = false;

        set((state) => {
          if (
            !state.currentTable ||
            !state.currentTable.isActive ||
            !state.activeGame
          ) {
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
      hydrateGame: async () => {
        let restoredState;
        try {
          restoredState = await restoreGameState();
        } catch {
          set({
            hydrated: true,
            syncError:
              'Lokale Sicherung konnte nicht geladen werden. Bestehende Daten bleiben erhalten.',
          });
          return;
        }

        if (
          !restoredState ||
          useGameStore.getState().localStateRestored ||
          useGameStore.getState().currentTable ||
          useGameStore.getState().cloudOwnerId
        ) {
          set({ hydrated: true });
          return;
        }

        set({
          archivedGameDays: archiveFinishedGameDay(
            mergeGameDayArchives(
              useGameStore.getState().archivedGameDays,
              restoredState.archivedGameDays ?? [],
            ),
            restoredState,
          ),
          currentTable: normalizeGameTable(restoredState.currentTable),
          players: restoredState.players,
          rounds: restoredState.rounds,
          balances: restoredState.balances,
          settlements: restoredState.settlements,
          activeGame: restoredState.activeGame,
          cloudOwnerId: restoredState.cloudOwnerId ?? null,
          cloudVersion: restoredState.cloudVersion ?? null,
          cloudBaseline: restoredState.cloudBaseline ?? null,
          hydrated: true,
        });
      },
      persistGame: async () => {
        try {
          await saveGameState(toPersistedGameState(useGameStore.getState()));
        } catch {
          set({
            syncError:
              'Lokale Sicherung konnte nicht gespeichert werden. Bitte erneut versuchen.',
          });
        }
      },
      clearPersistedGame: async () => {
        await clearGameState();
        set({ hydrated: true });
      },
      syncNow: async () => {
        await syncGameState();
      },
    }),
    {
      name: 'schafkopfrechner-games',
      storage: createJSONStorage(() => reliableStorage),
      partialize: (state) => ({
        games: state.games,
        archivedGameDays: state.archivedGameDays,
        currentTable: state.currentTable,
        players: state.players,
        rounds: state.rounds,
        balances: state.balances,
        settlements: state.settlements,
        activeGame: state.activeGame,
        tableOrderIds: state.tableOrderIds,
        lastSyncedAt: state.lastSyncedAt,
        cloudOwnerId: state.cloudOwnerId,
        cloudVersion: state.cloudVersion,
        cloudBaseline: state.cloudBaseline,
        isOffline: state.isOffline,
      }),
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState;
        }

        const nextState = normalizeRestoredTables({
          ...currentState,
          ...Object.fromEntries(
            Object.entries(persistedState).filter(([key]) =>
              [
                'games',
                'archivedGameDays',
                'currentTable',
                'players',
                'rounds',
                'balances',
                'settlements',
                'activeGame',
                'tableOrderIds',
                'lastSyncedAt',
                'cloudOwnerId',
                'cloudVersion',
                'cloudBaseline',
                'isOffline',
              ].includes(key),
            ),
          ),
        });

        return {
          ...nextState,
          localStateRestored: true,
          currentTable: normalizeGameTable(nextState.currentTable),
          archivedGameDays: archiveFinishedGameDay(
            mergeGameDayArchives(
              currentState.archivedGameDays,
              nextState.archivedGameDays ?? [],
            ),
            nextState,
          ),
          tableOrderIds: sanitizeTableOrderIds(nextState.tableOrderIds),
        };
      },
    },
  ),
);
