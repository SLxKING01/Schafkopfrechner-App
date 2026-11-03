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
import { syncSharedTable } from '../services/shared/sharedTables';
import { syncGameState } from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import { normalizeRestoredTables } from '../storage/validateGameState';
import type {
  ArchivedGameDay,
  CreateRoundPayload,
  GameRound,
  GameTable,
  InterimPayment,
  Player,
  PlayerBalance,
  Settlement,
  TableSettings,
} from '../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
  hasUniquePlayerIds,
  isCustomBooking,
  isValidRound,
  roundWinnerIds,
  toSafeCents,
} from '../utils/accounting';
import {
  activePlayers,
  getCurrentDealerId,
  hasPendingMisdeal,
  getNextDealerId,
  participationRevision,
  roundPlayers,
} from '../utils/dealerOrder';
import { normalizeGameOptions } from '../utils/formatGameOptions';
import {
  archiveFinishedGameDay,
  saveTableBeforeSwitch,
  mergeGameDayArchives,
} from '../utils/gameDayArchive';
import { outstandingBalances, paymentRevision } from '../utils/interimPayments';
import { repriceRounds } from '../utils/repriceRounds';
import {
  appendRoundHistory,
  restoredRoundOrder,
  roundHistoryFingerprint,
} from '../utils/roundHistory';
import {
  calculatePartyAmount,
  calculateRoundTariff,
  isValidRoundMetadata,
} from '../utils/roundTariff';
import { rewindUnchangedTurn, withRoundUndoContext } from '../utils/roundUndo';
import {
  exclusiveStockMode,
  replayStockRules,
  stockMode,
} from '../utils/stockRules';
import { tableAccess } from '../utils/tableAccess';
import {
  areTableOrderIdsEqual,
  sanitizeTableOrderIds,
} from '../utils/tableOrder';
import { useAuthStore } from './authStore';
import { useMatchDayStore } from './matchDayStore';
import { usePlayerStore } from './playerStore';
import { useProfileStore } from './profileStore';

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
  resumeTable: (tableId: string) => boolean;
  setPlayerOrder: (playerIds: string[]) => boolean;
  setPlayerAccount: (playerId: string, userId?: string) => boolean;
  setPlayerPaused: (
    tableId: string,
    playerId: string,
    paused: boolean,
  ) => boolean;
  recordMisdeal: (tableId: string, playerId: string) => boolean;
  setDealer: (tableId: string, playerId: string) => boolean;
  setTurboRamsch: (enabled: boolean) => void;
  togglePlayerLeger: (playerId: string) => void;
  addPlayer: (name: string) => boolean;
  removePlayer: (id: string) => void;
  addRound: (round: CreateRoundPayload) => boolean;
  roundError?: string;
  updateRound: (id: string, round: CreateRoundPayload) => boolean;
  undoLastRound: (
    expectedRoundId?: string,
    expectedEventId?: string,
    expectedFingerprint?: string,
    allowEarlierRound?: boolean,
  ) => boolean;
  restoreRound: (
    tableId: string,
    roundId: string,
    expectedEventId?: string,
  ) => boolean;
  revertRoundChange: (tableId: string, eventId: string) => boolean;
  recordInterimPayment: (
    tableId: string,
    revision: string,
    payment: Pick<
      InterimPayment,
      'id' | 'fromPlayerId' | 'toPlayerId' | 'amount'
    >,
  ) => boolean;
  settleInterimPayments: (tableId: string, revision: string) => boolean;
  voidInterimPayment: (tableId: string, id: string) => boolean;
  finishGameDay: (stockResolution?: 'refund' | 'carry') => boolean;
  markSettlementPaid: (id: string, isPaid?: boolean, tableId?: string) => void;
  resetGame: () => void;
  setTableOrderIds: (tableOrderIds: string[]) => void;
  updateCurrentTableSettings: (
    settings: TableSettings,
    scope?: 'future' | 'all',
  ) => boolean;
  hydrateGame: () => Promise<void>;
  persistGame: () => Promise<void>;
  clearPersistedGame: () => Promise<void>;
  syncNow: () => Promise<void>;
};

function hasTablePermission(manage = false, tableId?: string) {
  const state = useGameStore.getState();
  const table =
    !tableId || state.currentTable?.id === tableId
      ? state.currentTable
      : state.archivedGameDays.find((day) => day.table.id === tableId)?.table;
  const access = tableAccess(table, useAuthStore.getState().user?.id);
  return manage ? access.canManage : access.canWrite;
}

/** Build a validated round without changing the store or persisting speculative data. */
export function planRoundAddition(
  state: GameStore,
  round: CreateRoundPayload,
  roundId?: string,
): Partial<GameStore> | null {
  if (round.gameType === 'custom' && round.customAmounts === undefined)
    return null;
  if (
    round.stockAction &&
    !['deposit', 'payout', 'double'].includes(round.stockAction)
  )
    return null;
  if (
    !state.currentTable ||
    !state.currentTable.isActive ||
    !state.activeGame ||
    !isValidRound(round, state.players)
  ) {
    return null;
  }

  if (
    !exclusiveStockMode(state.currentTable.settings) ||
    (round.gameType === 'ramsch' &&
      !state.currentTable.settings.games.ramsch.enabled)
  )
    return null;
  const participants = roundPlayers(
    state.currentTable,
    state.players,
    state.rounds.length,
  );
  if (
    (round.stockAction === 'payout' || round.stockAction === 'double') &&
    getStockBalanceCents(state.rounds) === 0
  )
    return null;
  const monetary = isCustomBooking(round);
  if (
    round.participationRevision !== undefined &&
    round.participationRevision !==
      participationRevision(
        state.currentTable,
        state.players,
        state.rounds.length,
      )
  )
    return null;
  if (!monetary) {
    const expected = participants
      .map((p) => p.id)
      .sort()
      .join('|');
    const actual = (
      round.stockAction === 'deposit'
        ? round.loserIds
        : [...roundWinnerIds(round), ...round.loserIds]
    )
      .slice()
      .sort()
      .join('|');
    if (participants.length !== 4 || actual !== expected) return null;
  }
  if (round.tariffOptions) {
    try {
      const options = round.tariffOptions;
      const expectedLeger =
        state.currentTable.settings.bonusRules.leger.enabled &&
        getGameRules(state.currentTable.settings, round.gameType).bonuses.leger
          ? Math.min(4, state.currentTable.placedLegerPlayerIds?.length ?? 0)
          : 0;
      if (
        options.legerCount !== expectedLeger ||
        options.turboRamsch !== (state.currentTable.turboRamschEnabled ?? false)
      )
        return null;
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
      if (toSafeCents(round.amount) !== party.totalCents) return null;
    } catch {
      return null;
    }
  }
  const created = createGameRound(state.currentTable.id, {
    ...round,
    ...(!monetary ? { participantIds: participants.map((p) => p.id) } : {}),
    amount: toSafeCents(round.amount)! / 100,
    settingsSnapshot: state.currentTable.settings,
  });
  if (roundId) created.id = roundId;
  created.stockRulesVersion = 1;
  if (!isValidRoundMetadata(created)) return null;
  created.seatOrderIds = state.players.map((p) => p.id);
  created.roundContext = {
    completesDeal: !isCustomBooking(created) && round.stockAction !== 'deposit',
    dealerIdBefore:
      getCurrentDealerId(
        state.currentTable,
        state.players,
        state.rounds.length,
      ) ?? state.players[0].id,
    legerPlayerIds: [...(state.currentTable.placedLegerPlayerIds ?? [])],
    turboRamsch: state.currentTable.turboRamschEnabled ?? false,
  };
  let nextRounds: GameRound[];
  let nextGameState;
  try {
    nextRounds = replayStockRules(
      [...state.rounds, created],
      state.currentTable,
    );
    nextGameState = recalculateGameState(
      state.players,
      nextRounds,
      state.currentTable?.interimPayments,
    );
  } catch {
    return null;
  }

  return withRoundUndoContext(state, {
    rounds: nextRounds,
    currentTable: {
      ...appendRoundHistory(
        state.currentTable,
        state.rounds,
        nextRounds,
        state.players,
        roundHistoryActor(),
        created.id,
      ),
      placedLegerPlayerIds: created.roundContext.completesDeal
        ? []
        : state.currentTable.placedLegerPlayerIds,
      dealerId: created.roundContext.completesDeal
        ? (getNextDealerId(
            state.currentTable,
            state.players,
            state.rounds.length,
          ) ?? undefined)
        : created.roundContext.dealerIdBefore,
    },
    ...nextGameState,
    isOffline: false,
  });
}

function roundHistoryActor(): import('../types/game').RoundHistoryActor {
  const user = useAuthStore.getState().user;
  if (!user) return { kind: 'local', name: 'Lokale Erfassung' };
  const profileState = useProfileStore.getState();
  const label =
    (profileState.ownerId === user.id
      ? profileState.profile?.displayName
      : undefined) ??
    user.user_metadata?.display_name ??
    user.user_metadata?.username;
  return {
    kind: 'account',
    id: user.id,
    name:
      typeof label === 'string' && label.trim()
        ? label.trim()
        : 'Angemeldeter Nutzer',
  };
}

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

function recalculateGameState(
  players: Player[],
  rounds: GameRound[],
  payments: InterimPayment[] = [],
) {
  const balances = calculateMvpBalances(players, rounds);
  const settlements =
    getStockBalanceCents(rounds) > 0
      ? []
      : finishGameDayService(outstandingBalances(balances, payments));

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
    (set): GameStore => ({
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
              ...(game.winnerIds ? { winnerIds: [...game.winnerIds] } : {}),
              participantNames: Object.fromEntries(
                usePlayerStore
                  .getState()
                  .players.filter(({ id }) =>
                    [...roundWinnerIds(game), ...game.loserIds].includes(id),
                  )
                  .map(({ id, name }) => [id, name]),
              ),
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
              ...(updatedGame.winnerIds
                ? { winnerIds: [...updatedGame.winnerIds] }
                : {}),
              participantNames: {
                ...game.participantNames,
                ...Object.fromEntries(
                  usePlayerStore
                    .getState()
                    .players.filter(({ id }) =>
                      [
                        ...roundWinnerIds(updatedGame),
                        ...updatedGame.loserIds,
                      ].includes(id),
                    )
                    .map(({ id, name }) => [id, name]),
                ),
              },
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
          (settings !== undefined && !exclusiveStockMode(settings)) ||
          uniquePlayers.length < 2 ||
          activePlayers(uniquePlayers).length > 5 ||
          !hasUniquePlayerIds(players) ||
          players.some((player) => !player.name.trim())
        ) {
          return false;
        }

        set((state) => ({
          archivedGameDays: saveTableBeforeSwitch(
            state.archivedGameDays,
            state,
          ),
          currentTable: createGameTable({
            existingHashCodes: [
              state.currentTable,
              ...state.archivedGameDays.map(({ table }) => table),
            ].flatMap((table) => (table?.hashCode ? [table.hashCode] : [])),
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
      resumeTable: (tableId) => {
        const state = useGameStore.getState();
        const saved = state.archivedGameDays.find(
          ({ table }) => table.id === tableId && table.isActive,
        );
        if (!saved) return false;
        set({
          archivedGameDays: saveTableBeforeSwitch(
            state.archivedGameDays.filter(({ table }) => table.id !== tableId),
            state,
          ),
          currentTable: saved.table,
          players: saved.players,
          rounds: saved.rounds,
          balances: saved.balances,
          settlements: saved.settlements,
          activeGame: true,
        });
        return true;
      },
      togglePlayerLeger: (playerId) => {
        if (!hasTablePermission(false)) return;
        set((state) => {
          if (
            !state.currentTable ||
            !state.activeGame ||
            !state.currentTable.isActive ||
            !state.currentTable.settings.bonusRules.leger.enabled ||
            !roundPlayers(
              state.currentTable,
              state.players,
              state.rounds.length,
            ).some((player) => player.id === playerId)
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
        if (!hasTablePermission(false)) return;
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
      setPlayerPaused: (tableId, playerId, paused) => {
        if (!hasTablePermission(true, tableId)) return false;
        let changed = false;
        set((state) => {
          if (
            !state.activeGame ||
            !state.currentTable?.isActive ||
            state.currentTable.id !== tableId ||
            !state.players.some((p) => p.id === playerId)
          )
            return state;
          const players = state.players.map((p) =>
            p.id === playerId ? { ...p, isPaused: paused } : p,
          );
          if (activePlayers(players).length > 5) return state;
          const dealerId =
            getCurrentDealerId(
              state.currentTable,
              players,
              state.rounds.length,
            ) ?? undefined;
          const participants = new Set(
            roundPlayers(
              { ...state.currentTable, dealerId },
              players,
              state.rounds.length,
            ).map((p) => p.id),
          );
          changed = true;
          return {
            players,
            currentTable: {
              ...state.currentTable,
              dealerId,
              placedLegerPlayerIds: (
                state.currentTable.placedLegerPlayerIds ?? []
              ).filter((id) => participants.has(id)),
            },
          };
        });
        return changed;
      },
      recordMisdeal: (tableId, playerId) => {
        if (!hasTablePermission(true, tableId)) return false;
        const state = useGameStore.getState();
        const table = state.currentTable;
        if (
          !table?.isActive ||
          !state.activeGame ||
          table.id !== tableId ||
          !table.settings.misdealPenaltyEnabled ||
          getCurrentDealerId(table, state.players, state.rounds.length) !==
            playerId
        )
          return false;

        const id = crypto.randomUUID();
        const event = {
          id,
          playerId,
          occurredAt: new Date().toISOString(),
          actor: roundHistoryActor(),
        };
        if (!hasPendingMisdeal(table, state.rounds, playerId)) {
          set({
            currentTable: {
              ...table,
              misdeals: [...(table.misdeals ?? []), event],
            },
          });
          return true;
        }

        const recipients = activePlayers(state.players).filter(
          (p) => p.id !== playerId,
        );
        const tariff = toSafeCents(table.settings.games.solo.value);
        if (!tariff || !recipients.length) return false;
        const amount = (tariff * recipients.length) / 100;
        const patch = planRoundAddition(
          state,
          {
            gameType: 'custom',
            misdealPlayerId: playerId,
            amount,
            winnerId: '',
            winnerIds: [],
            loserIds: [],
            customAmounts: [
              { playerId, amount: -amount },
              ...recipients.map(({ id }) => ({
                playerId: id,
                amount: tariff / 100,
              })),
            ],
          },
          id,
        );
        if (!patch?.currentTable) return false;
        set({
          ...patch,
          currentTable: {
            ...patch.currentTable,
            misdeals: [
              ...(table.misdeals ?? []),
              { ...event, penaltyRoundId: id },
            ],
          },
        });
        return true;
      },
      setDealer: (tableId, playerId) => {
        if (!hasTablePermission(true, tableId)) return false;
        let didUpdate = false;
        set((state) => {
          if (
            !state.currentTable ||
            state.currentTable.id !== tableId ||
            !state.currentTable.isActive ||
            !state.activeGame ||
            !state.players.some(
              ({ id, isPaused }) => id === playerId && !isPaused,
            )
          )
            return state;
          didUpdate = true;
          if (state.currentTable.dealerId === playerId) return state;
          return {
            currentTable: {
              ...state.currentTable,
              dealerId: playerId,
              ...(state.currentTable.placedLegerPlayerIds
                ? {
                    placedLegerPlayerIds:
                      state.currentTable.placedLegerPlayerIds.filter((id) =>
                        roundPlayers(
                          { ...state.currentTable!, dealerId: playerId },
                          state.players,
                          state.rounds.length,
                        ).some((p) => p.id === id),
                      ),
                  }
                : {}),
            },
          };
        });
        return didUpdate;
      },
      setPlayerAccount: (playerId, userId) => {
        if (!hasTablePermission(true)) return false;
        // Foreign accounts are linked only by the server after invitation acceptance.
        if (userId && userId !== useAuthStore.getState().user?.id) return false;
        const state = useGameStore.getState();
        if (
          !state.activeGame ||
          !state.currentTable?.isActive ||
          !state.players.some((p) => p.id === playerId) ||
          (userId &&
            state.players.some((p) => p.id !== playerId && p.userId === userId))
        )
          return false;
        const actor = useAuthStore.getState().user?.id;
        if (
          state.currentTable.shared &&
          state.currentTable.shared.ownerId !== actor
        )
          return false;
        set({
          players: state.players.map((p) =>
            p.id === playerId ? { ...p, userId, isLocal: !userId } : p,
          ),
        });
        return true;
      },
      setPlayerOrder: (playerIds) => {
        if (!hasTablePermission(true)) return false;
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
        if (!hasTablePermission(true)) return false;
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

          if (activePlayers(state.players).length >= 5) return state;
          const nextPlayers = [...state.players, createLocalPlayer(playerName)];
          let nextGameState;
          try {
            nextGameState = recalculateGameState(
              nextPlayers,
              state.rounds,
              state.currentTable?.interimPayments,
            );
          } catch {
            return state;
          }
          didAdd = true;

          return {
            players: nextPlayers,
            ...(state.currentTable?.placedLegerPlayerIds
              ? {
                  currentTable: {
                    ...state.currentTable,
                    placedLegerPlayerIds:
                      state.currentTable.placedLegerPlayerIds.filter((id) =>
                        roundPlayers(
                          state.currentTable,
                          nextPlayers,
                          state.rounds.length,
                        ).some((p) => p.id === id),
                      ),
                  },
                }
              : {}),
            ...nextGameState,
          };
        });

        return didAdd;
      },
      removePlayer: (id) => {
        if (!hasTablePermission(true)) return;
        set((state) => {
          if (
            state.currentTable &&
            (!state.activeGame || !state.currentTable.isActive)
          )
            return state;
          const playerHasRounds = state.rounds.some(
            (round) =>
              roundWinnerIds(round).includes(id) ||
              round.loserIds.includes(id) ||
              !!round.customAmounts?.some((entry) => entry.playerId === id) ||
              !!round.participantIds?.includes(id) ||
              !!round.seatOrderIds?.includes(id),
          );

          if (playerHasRounds) {
            return state;
          }

          const nextPlayers = state.players.filter(
            (player) => player.id !== id,
          );
          let nextGameState;
          try {
            nextGameState = recalculateGameState(
              nextPlayers,
              state.rounds,
              state.currentTable?.interimPayments,
            );
          } catch {
            return state;
          }

          return {
            players: nextPlayers,
            currentTable: state.currentTable
              ? {
                  ...state.currentTable,
                  dealerId:
                    getCurrentDealerId(
                      state.currentTable,
                      state.players.map((p) =>
                        p.id === id ? { ...p, isPaused: true } : p,
                      ),
                      state.rounds.length,
                    ) ?? undefined,
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
        if (!hasTablePermission(false)) return false;
        set({ roundError: undefined });
        if (round.gameType === 'custom' && round.customAmounts === undefined)
          return false;
        if (
          round.stockAction &&
          !['deposit', 'payout', 'double'].includes(round.stockAction)
        )
          return false;
        let didAdd = false;

        const patch = planRoundAddition(useGameStore.getState(), round);
        if (patch) {
          set(patch);
          didAdd = true;
        }

        return didAdd;
      },
      updateRound: (id, payload) => {
        if (!hasTablePermission(false)) return false;
        set({ roundError: undefined });
        const state = useGameStore.getState();
        if (
          state.rounds.some(
            (round) => round.id === id && round.misdealPlayerId,
          ) ||
          !state.activeGame ||
          !state.currentTable?.isActive ||
          !isValidRound(payload, state.players)
        )
          return false;
        const original = state.rounds.find((round) => round.id === id);
        if (!original) return false;
        // Explicitly adding Kontra/Re to a past round enables only that rule
        // in its own snapshot. All original tariffs and other rounds stay intact.
        const correctedSettings =
          (payload.tariffOptions?.stoss ?? 0) > 0
            ? {
                ...original.settingsSnapshot,
                bonusRules: {
                  ...original.settingsSnapshot.bonusRules,
                  stoss: {
                    ...original.settingsSnapshot.bonusRules.stoss,
                    enabled: true,
                  },
                },
              }
            : original.settingsSnapshot;
        if (
          original.stockAction === 'deposit' &&
          payload.stockAction === 'deposit' &&
          (original.stockCompletesDeal ?? true) !==
            (payload.stockCompletesDeal ?? true)
        )
          return false;
        if (
          original.declarerId &&
          ['rufspiel', 'sauspiel', 'hochzeit', 'kreuzbock'].includes(
            payload.gameType,
          ) &&
          !payload.clearPartyMetadata &&
          (!payload.declarerId || !payload.partnerId)
        )
          return false;
        if (
          (original.stockAction &&
            !['deposit', 'payout', 'double'].includes(original.stockAction)) ||
          (payload.stockAction &&
            !['deposit', 'payout', 'double'].includes(payload.stockAction))
        )
          return false;
        if (
          payload.clearPartyMetadata &&
          (payload.declarerId ||
            payload.partnerId ||
            !['rufspiel', 'sauspiel', 'hochzeit', 'kreuzbock'].includes(
              payload.gameType,
            ))
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
                (
                  original.participantIds ?? state.players.map((p) => p.id)
                ).includes(playerId),
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
              correctedSettings,
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
            settingsSnapshot: correctedSettings,
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
            customAmounts: payload.customAmounts?.map((entry) => ({
              ...entry,
            })),
            suit: payload.suit,
            stockAction: payload.stockAction,
            stockCompletesDeal: payload.stockCompletesDeal,
            declarerId: payload.declarerId,
            declarerWon: payload.declarerId
              ? roundWinnerIds(payload).includes(payload.declarerId)
              : undefined,
            partnerId: payload.partnerId,
            tariffOptions: payload.tariffOptions
              ? { ...payload.tariffOptions }
              : undefined,
            updatedAt: new Date().toISOString(),
          };
          if (!isValidRoundMetadata(changed)) return false;
          const nextRounds = replayStockRules(
            state.rounds.map((round) => (round.id === id ? changed : round)),
            state.currentTable,
          );
          const calculated = recalculateGameState(
            state.players,
            nextRounds,
            state.currentTable?.interimPayments,
          );
          set(
            withRoundUndoContext(state, {
              rounds: nextRounds,
              ...calculated,
              currentTable: appendRoundHistory(
                state.currentTable,
                state.rounds,
                nextRounds,
                state.players,
                roundHistoryActor(),
                id,
              ),
              isOffline: false,
            }),
          );
          return true;
        } catch (error) {
          set({
            roundError: error instanceof Error ? error.message : undefined,
          });
          return false;
        }
      },
      restoreRound: (tableId, roundId, expectedEventId) => {
        if (!hasTablePermission(false, tableId)) return false;
        set({ roundError: undefined });
        const state = useGameStore.getState();
        const table = state.currentTable;
        const fail = (message: string) => {
          set({ roundError: message });
          return false;
        };
        if (!state.activeGame || !table?.isActive || table.id !== tableId)
          return fail(
            'Wiederherstellen ist nur am geöffneten, laufenden Tisch möglich.',
          );
        const event = table.roundHistory
          ?.slice()
          .reverse()
          .find((e) => e.roundId === roundId);
        if (
          state.rounds.some((r) => r.id === roundId) ||
          event?.action !== 'deleted' ||
          !event.before ||
          (expectedEventId !== undefined && event.id !== expectedEventId)
        )
          return fail(
            'Das Spiel ist bereits vorhanden oder nicht mehr zur Wiederherstellung verfügbar.',
          );
        const restored: GameRound = JSON.parse(JSON.stringify(event.before));
        if (
          restored.stockAction === 'carryIn' ||
          restored.stockAction === 'carryOut' ||
          restored.stockAction === 'refund'
        )
          return fail(
            'Überträge und Abschlussbuchungen können hier nicht wiederhergestellt werden.',
          );
        if (
          !isValidRound(restored, state.players) ||
          !isValidRoundMetadata(restored)
        )
          return fail(
            'Die ursprünglichen Spieler oder Rundendaten sind nicht mehr vollständig vorhanden.',
          );
        try {
          const order = restoredRoundOrder(table, state.rounds, roundId);
          const byId = new Map(
            [...state.rounds, restored].map((r) => [r.id, r]),
          );
          const nextRounds = replayStockRules(
            order.map((id) => byId.get(id)!),
            table,
          );
          const calculated = recalculateGameState(
            state.players,
            nextRounds,
            table.interimPayments,
          );
          const historyTable = appendRoundHistory(
            table,
            state.rounds,
            nextRounds,
            state.players,
            roundHistoryActor(),
            roundId,
            event.id,
          );
          set(
            withRoundUndoContext(state, {
              rounds: nextRounds,
              ...calculated,
              currentTable: {
                ...historyTable,
                ...rewindUnchangedTurn(state, event),
              },
              isOffline: false,
            }),
          );
          return true;
        } catch (error) {
          return fail(
            error instanceof Error
              ? error.message
              : 'Das Spiel konnte nicht wiederhergestellt werden.',
          );
        }
      },
      undoLastRound: (
        expectedRoundId,
        expectedEventId,
        expectedFingerprint,
        allowEarlierRound = false,
      ) => {
        if (!hasTablePermission(false)) return false;
        set({ roundError: undefined });
        const state = useGameStore.getState();
        const table = state.currentTable;
        const latest = state.rounds.at(-1);
        const target = allowEarlierRound
          ? state.rounds.find(({ id }) => id === expectedRoundId)
          : latest;
        if (
          expectedRoundId !== undefined &&
          (!target ||
            target.id !== expectedRoundId ||
            (expectedFingerprint !== undefined &&
              roundHistoryFingerprint(target) !== expectedFingerprint) ||
            (expectedEventId !== undefined &&
              table?.roundHistory?.filter((e) => e.roundId === target.id).at(-1)
                ?.id !== expectedEventId))
        ) {
          set({
            roundError:
              'Die letzte Runde wurde inzwischen geändert. Bitte den aktuellen Stand prüfen und die Rücknahme erneut öffnen.',
          });
          return false;
        }
        if (
          !state.activeGame ||
          !table?.isActive ||
          !target ||
          ['carryIn', 'carryOut', 'refund'].includes(target.stockAction ?? '')
        )
          return false;
        try {
          const nextRounds = replayStockRules(
            state.rounds.filter(({ id }) => id !== target.id),
            table,
          );
          const calculated = recalculateGameState(
            state.players,
            nextRounds,
            table.interimPayments,
          );
          const creation = table.roundHistory
            ?.slice()
            .reverse()
            .find(
              (e) =>
                e.roundId === target.id &&
                (e.action === 'created' || e.action === 'restored'),
            );
          const historyTable = appendRoundHistory(
            table,
            state.rounds,
            nextRounds,
            state.players,
            roundHistoryActor(),
            target.id,
          );
          set(
            withRoundUndoContext(state, {
              rounds: nextRounds,
              ...calculated,
              currentTable: {
                ...historyTable,
                ...(target === latest
                  ? rewindUnchangedTurn(state, creation)
                  : {}),
              },
              isOffline: false,
            }),
          );
          return true;
        } catch (error) {
          set({
            roundError:
              error instanceof Error
                ? error.message
                : 'Die Runde konnte nicht zurückgenommen werden.',
          });
          return false;
        }
      },
      revertRoundChange: (tableId, eventId) => {
        set({ roundError: undefined });
        const state = useGameStore.getState();
        const table = state.currentTable;
        const fail = (message: string) => {
          set({ roundError: message });
          return false;
        };
        if (!hasTablePermission(false, tableId))
          return fail(
            'Du hast kein Schreibrecht mehr. Der Tisch bleibt unverändert.',
          );
        if (!state.activeGame || !table?.isActive || table.id !== tableId)
          return fail(
            'Rückgängig ist nur am geöffneten, laufenden Tisch möglich.',
          );
        const event = table.roundHistory?.find((e) => e.id === eventId);
        if (
          !event ||
          event.causeRoundId ||
          table.roundHistory?.filter((e) => e.roundId === event.roundId).at(-1)
            ?.id !== eventId
        )
          return fail(
            'Dieses Spiel wurde inzwischen geändert. Bitte den aktuellen Änderungsverlauf prüfen.',
          );
        if (event.action === 'deleted')
          return state.restoreRound(tableId, event.roundId, event.id);
        const current = state.rounds.find(
          (round) => round.id === event.roundId,
        );
        if (
          !current ||
          !event.after ||
          roundHistoryFingerprint(current) !==
            roundHistoryFingerprint(event.after)
        )
          return fail(
            'Dieses Spiel wurde inzwischen geändert oder gelöscht. Bitte den aktuellen Stand prüfen.',
          );
        if (
          ['carryIn', 'carryOut', 'refund'].includes(current.stockAction ?? '')
        )
          return fail(
            'Überträge und Abschlussbuchungen können hier nicht zurückgenommen werden.',
          );
        try {
          const original =
            event.action === 'updated' ? event.before : undefined;
          if (
            original &&
            (!isValidRound(original, state.players) ||
              !isValidRoundMetadata(original))
          )
            return fail(
              'Die ursprünglichen Spieler oder Rundendaten sind nicht vollständig vorhanden.',
            );
          if (event.action === 'updated' && !original)
            return fail('Die ursprüngliche Fassung ist nicht verfügbar.');
          const planned = original
            ? state.rounds.map((round) =>
                round.id === event.roundId
                  ? ({
                      ...JSON.parse(JSON.stringify(original)),
                      updatedAt: new Date().toISOString(),
                    } as GameRound)
                  : round,
              )
            : state.rounds.filter((round) => round.id !== event.roundId);
          const nextRounds = replayStockRules(planned, table);
          const calculated = recalculateGameState(
            state.players,
            nextRounds,
            table.interimPayments,
          );
          const historyTable = appendRoundHistory(
            table,
            state.rounds,
            nextRounds,
            state.players,
            roundHistoryActor(),
            event.roundId,
            event.id,
          );
          set(
            withRoundUndoContext(state, {
              rounds: nextRounds,
              ...calculated,
              currentTable: {
                ...historyTable,
                ...rewindUnchangedTurn(state, event),
              },
              isOffline: false,
            }),
          );
          return true;
        } catch (error) {
          return fail(
            error instanceof Error
              ? error.message
              : 'Die Änderung konnte nicht zurückgenommen werden.',
          );
        }
      },
      recordInterimPayment: (tableId, revision, payment) => {
        if (!hasTablePermission(true, tableId)) return false;
        let saved = false;
        set((state) => {
          const table = state.currentTable;
          if (
            !table ||
            table.id !== tableId ||
            !state.activeGame ||
            !table.isActive
          )
            return state;
          const existing = table.interimPayments?.find(
            ({ id }) => id === payment.id,
          );
          if (existing) {
            saved =
              !existing.voidedAt &&
              existing.fromPlayerId === payment.fromPlayerId &&
              existing.toPlayerId === payment.toPlayerId &&
              existing.amount === payment.amount;
            return state;
          }
          if (paymentRevision(table, state.balances) !== revision) return state;
          try {
            const due = outstandingBalances(
              state.balances,
              table.interimPayments,
            );
            const cents = toSafeCents(payment.amount);
            const from = toSafeCents(
              due.find(({ playerId }) => playerId === payment.fromPlayerId)
                ?.amount ?? 0,
            )!;
            const to = toSafeCents(
              due.find(({ playerId }) => playerId === payment.toPlayerId)
                ?.amount ?? 0,
            )!;
            if (
              !payment.id ||
              cents === null ||
              cents <= 0 ||
              from >= 0 ||
              to <= 0 ||
              cents > Math.min(-from, to)
            )
              return state;
            const interimPayments = [
              ...(table.interimPayments ?? []),
              { ...payment, createdAt: new Date().toISOString() },
            ];
            const calculated = recalculateGameState(
              state.players,
              state.rounds,
              interimPayments,
            );
            saved = true;
            return {
              currentTable: { ...table, interimPayments },
              ...calculated,
            };
          } catch {
            return state;
          }
        });
        return saved;
      },
      settleInterimPayments: (tableId, revision) => {
        if (!hasTablePermission(true, tableId)) return false;
        let saved = false;
        set((state) => {
          const table = state.currentTable;
          if (
            !table ||
            table.id !== tableId ||
            !table.isActive ||
            !state.activeGame ||
            paymentRevision(table, state.balances) !== revision ||
            getStockBalanceCents(state.rounds) > 0
          )
            return state;
          try {
            const plan = finishGameDayService(
              outstandingBalances(state.balances, table.interimPayments),
            );
            if (!plan.length) return state;
            const interimPayments = [
              ...(table.interimPayments ?? []),
              ...plan.map((p) => ({
                id: crypto.randomUUID(),
                fromPlayerId: p.fromPlayerId,
                toPlayerId: p.toPlayerId,
                amount: p.amount,
                createdAt: new Date().toISOString(),
              })),
            ];
            const calculated = recalculateGameState(
              state.players,
              state.rounds,
              interimPayments,
            );
            saved = true;
            return {
              currentTable: { ...table, interimPayments },
              ...calculated,
            };
          } catch {
            return state;
          }
        });
        return saved;
      },
      voidInterimPayment: (tableId, id) => {
        if (!hasTablePermission(true, tableId)) return false;
        let saved = false;
        set((state) => {
          const table = state.currentTable;
          if (
            !table ||
            table.id !== tableId ||
            !table.isActive ||
            !state.activeGame ||
            !table.interimPayments?.some((p) => p.id === id && !p.voidedAt)
          )
            return state;
          try {
            const interimPayments = table.interimPayments.map((p) =>
              p.id === id ? { ...p, voidedAt: new Date().toISOString() } : p,
            );
            const calculated = recalculateGameState(
              state.players,
              state.rounds,
              interimPayments,
            );
            saved = true;
            return {
              currentTable: { ...table, interimPayments },
              ...calculated,
            };
          } catch {
            return state;
          }
        });
        return saved;
      },
      finishGameDay: (stockResolution) => {
        if (!hasTablePermission(true)) return false;
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
                loserIds: activePlayers(state.players).map(({ id }) => id),
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
                    loserIds: activePlayers(state.players).map(({ id }) => id),
                    gameType: 'stock',
                    amount: pot / 100,
                    stockAction: 'carryIn',
                    settingsSnapshot: carryTable.settings,
                  }),
                ];
              }
            }
            calculated = recalculateGameState(
              state.players,
              closingRounds,
              state.currentTable?.interimPayments,
            );
            if (carryTable) {
              recalculateGameState(state.players, carryRounds);
              carryTable = appendRoundHistory(
                carryTable,
                [],
                carryRounds,
                state.players,
                roundHistoryActor(),
              );
            }
          } catch {
            return state;
          }
          const closed = {
            ...state,
            ...calculated,
            rounds: closingRounds,
            activeGame: false,
            currentTable: {
              ...appendRoundHistory(
                state.currentTable,
                state.rounds,
                closingRounds,
                state.players,
                roundHistoryActor(),
              ),
              isActive: false,
            },
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
        if (!hasTablePermission(true, tableId)) return;
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
      updateCurrentTableSettings: (settings, scope = 'future') => {
        if (!hasTablePermission(true)) return false;
        set({ roundError: undefined });
        let didUpdate = false;

        set((state) => {
          if (
            !state.currentTable ||
            !state.currentTable.isActive ||
            !state.activeGame
          ) {
            return state;
          }

          if (!exclusiveStockMode(settings)) return state;
          if (
            stockMode(settings) !== stockMode(state.currentTable.settings) &&
            getStockBalanceCents(state.rounds) > 0
          )
            return state;
          const normalized = normalizeTableSettings(settings);
          let repriced = {};
          let nextTable: GameTable = {
            ...state.currentTable,
            settings: normalized,
          };
          if (scope === 'all') {
            try {
              const nextRounds = replayStockRules(
                repriceRounds(state.rounds, normalized),
                nextTable,
              );
              repriced = {
                rounds: nextRounds,
                ...recalculateGameState(
                  state.players,
                  nextRounds,
                  state.currentTable.interimPayments,
                ),
              };
              nextTable = appendRoundHistory(
                nextTable,
                state.rounds,
                nextRounds,
                state.players,
                roundHistoryActor(),
              );
            } catch (error) {
              return {
                roundError:
                  error instanceof Error
                    ? error.message
                    : 'Die bisherigen Spiele konnten nicht neu berechnet werden.',
              };
            }
          }
          didUpdate = true;

          return {
            ...repriced,
            currentTable: nextTable,
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
        if (useGameStore.getState().currentTable?.shared)
          await syncSharedTable();
        else await syncGameState();
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
