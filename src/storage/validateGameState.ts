import { normalizeTableSettings } from '../constants/tableSettings';
import type { Game } from '../models/Game';
import type {
  ArchivedGameDay,
  GameRound,
  GameTable,
  Player,
} from '../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
  hasUniquePlayerIds,
  isValidRound,
  toSafeCents,
} from '../utils/accounting';
import { isValidRoundMetadata } from '../utils/roundTariff';

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
function players(value: unknown): value is Player[] {
  return (
    Array.isArray(value) &&
    value.every((p) => record(p) && text(p.id) && text(p.name)) &&
    hasUniquePlayerIds(value)
  );
}
function identified(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((v) => record(v) && text(v.id)) &&
    new Set(value.map((v) => v.id)).size === value.length
  );
}
function table(value: unknown): value is GameTable {
  return (
    record(value) &&
    text(value.id) &&
    text(value.name) &&
    typeof value.isActive === 'boolean' &&
    text(value.createdAt) &&
    settings(value.settings)
  );
}
function settings(value: unknown): boolean {
  return (
    record(value) &&
    (value.gameRules === undefined ||
      (record(value.gameRules) &&
        Object.values(value.gameRules).every(
          (rule) =>
            record(rule) &&
            record(rule.bonuses) &&
            ['laufende', 'schneider', 'schwarz', 'stoss', 'leger'].every(
              (key) =>
                typeof rule.bonuses === 'object' &&
                rule.bonuses !== null &&
                typeof (rule.bonuses as Record<string, unknown>)[key] ===
                  'boolean',
            ) &&
            Number.isInteger(rule.laufendeMin) &&
            Number.isInteger(rule.laufendeMax) &&
            (rule.laufendeMin as number) >= 1 &&
            (rule.laufendeMax as number) <= 14 &&
            (rule.laufendeMax as number) >= (rule.laufendeMin as number) &&
            typeof rule.ramschJungfrau === 'boolean' &&
            typeof rule.ramschDurchmarsch === 'boolean',
        ))) &&
    ['games', 'bonusRules'].every((key) => {
      const entries = value[key];
      return (
        record(entries) &&
        Object.values(entries).every(
          (entry) =>
            record(entry) &&
            typeof entry.enabled === 'boolean' &&
            (entry.mode === 'price' || entry.mode === 'multiplier') &&
            typeof entry.value === 'number' &&
            Number.isFinite(entry.value) &&
            entry.value >= 0,
        )
      );
    })
  );
}
function day(value: unknown): boolean {
  if (
    !record(value) ||
    !players(value.players) ||
    !identified(value.rounds) ||
    !Array.isArray(value.balances) ||
    !identified(value.settlements)
  )
    return false;
  if (
    typeof value.activeGame !== 'boolean' ||
    !(value.currentTable === null || table(value.currentTable))
  )
    return false;
  if (
    value.currentTable === null &&
    (value.activeGame ||
      value.rounds.length ||
      value.players.length ||
      value.settlements.length ||
      value.balances.length)
  )
    return false;
  if (value.currentTable && value.currentTable.isActive !== value.activeGame)
    return false;
  if (
    value.currentTable?.placedLegerPlayerIds !== undefined &&
    (!Array.isArray(value.currentTable.placedLegerPlayerIds) ||
      new Set(value.currentTable.placedLegerPlayerIds).size !==
        value.currentTable.placedLegerPlayerIds.length ||
      !value.currentTable.placedLegerPlayerIds.every(
        (id) =>
          value.players instanceof Array &&
          value.players.some((p) => p.id === id),
      ))
  )
    return false;
  const roster = value.players;
  const ids = new Set(roster.map((p) => p.id));
  if (
    !value.rounds.every(
      (r) =>
        r.tableId === (value.currentTable as GameTable)?.id &&
        text(r.createdAt) &&
        text(r.gameType) &&
        settings(r.settingsSnapshot) &&
        isValidRound(r as unknown as GameRound, roster) &&
        isValidRoundMetadata(r as unknown as GameRound),
    )
  )
    return false;
  try {
    const expected = calculateRoundBalances(
      roster,
      value.rounds as unknown as GameRound[],
      'id',
    );
    if (
      value.balances.length !== expected.length ||
      new Set(value.balances.map((b) => (record(b) ? b.playerId : null)))
        .size !== expected.length ||
      !expected.every(
        (e) =>
          value.balances instanceof Array &&
          value.balances.some(
            (b) =>
              record(b) &&
              b.playerId === e.playerId &&
              toSafeCents(b.amount as number) === toSafeCents(e.amount),
          ),
      )
    )
      return false;
  } catch {
    return false;
  }
  if (
    !value.balances.every(
      (b) =>
        record(b) &&
        ids.has(b.playerId as string) &&
        toSafeCents(b.amount as number) !== null,
    )
  )
    return false;
  if (
    !value.settlements.every(
      (s) =>
        ids.has(s.fromPlayerId as string) &&
        ids.has(s.toPlayerId as string) &&
        s.fromPlayerId !== s.toPlayerId &&
        typeof s.isPaid === 'boolean' &&
        toSafeCents(s.amount as number) !== null &&
        (s.amount as number) > 0,
    )
  )
    return false;
  const remaining = new Map(
    (value.balances as { playerId: string; amount: number }[]).map((b) => [
      b.playerId,
      toSafeCents(b.amount)!,
    ]),
  );
  const stock = getStockBalanceCents(value.rounds as unknown as GameRound[]);
  if (stock > 0)
    return value.activeGame === true && value.settlements.length === 0;
  for (const payment of value.settlements) {
    const from = payment.fromPlayerId as string;
    const to = payment.toPlayerId as string;
    const cents = toSafeCents(payment.amount as number)!;
    remaining.set(from, remaining.get(from)! + cents);
    remaining.set(to, remaining.get(to)! - cents);
    if (![remaining.get(from), remaining.get(to)].every(Number.isSafeInteger))
      return false;
  }
  return [...remaining.values()].every((cents) => cents === 0);
}
function validCloudMetadata(value: Record<string, unknown>) {
  return (
    ['cloudOwnerId', 'cloudBaseline'].every(
      (key) =>
        value[key] === undefined ||
        value[key] === null ||
        typeof value[key] === 'string',
    ) &&
    (value.cloudVersion === undefined ||
      value.cloudVersion === null ||
      (Number.isSafeInteger(value.cloudVersion) &&
        (value.cloudVersion as number) >= 0))
  );
}
export function validGameSnapshot(value: unknown): boolean {
  if (!day(value) || !record(value) || !validCloudMetadata(value)) return false;
  if (
    value.archivedGameDays !== undefined &&
    (!Array.isArray(value.archivedGameDays) ||
      new Set(
        value.archivedGameDays.map((a) =>
          record(a) && record(a.table) ? a.table.id : null,
        ),
      ).size !== value.archivedGameDays.length ||
      !value.archivedGameDays.every(
        (a) =>
          record(a) &&
          table(a.table) &&
          a.table.isActive === false &&
          day({ ...a, currentTable: a.table, activeGame: false }),
      ))
  )
    return false;
  return true;
}
export function validSavedPlayers(value: unknown): boolean {
  return record(value) && players(value.players);
}
export function validMatchDays(value: unknown): boolean {
  return (
    record(value) &&
    identified(value.matchDays) &&
    value.matchDays.every(
      (d) =>
        text(d.name) &&
        text(d.createdAt) &&
        typeof d.isActive === 'boolean' &&
        (d.isClosed === undefined || typeof d.isClosed === 'boolean'),
    ) &&
    (value.activeMatchDayId === null ||
      value.matchDays.some((d) => d.id === value.activeMatchDayId))
  );
}
export function validLegacyGames(value: unknown): boolean {
  return (
    identified(value) &&
    value.every(
      (g) =>
        text(g.winnerId) &&
        Array.isArray(g.loserIds) &&
        g.loserIds.length > 0 &&
        g.loserIds.every(text) &&
        new Set(g.loserIds).size === g.loserIds.length &&
        !g.loserIds.includes(g.winnerId) &&
        toSafeCents(g.amount as number) !== null &&
        (g.amount as number) > 0 &&
        text(g.createdAt),
    )
  );
}
export function validCloudSnapshot(value: unknown): boolean {
  if (
    !(
      record(value) &&
      value.schemaVersion === 1 &&
      validGameSnapshot(value) &&
      validSavedPlayers({ players: value.savedPlayers }) &&
      validMatchDays(value) &&
      validLegacyGames(value.games) &&
      Array.isArray(value.tableOrderIds) &&
      value.tableOrderIds.every(text)
    )
  )
    return false;
  const state = value as {
    savedPlayers: Player[];
    games: Game[];
    matchDays: { id: string }[];
    activeMatchDayId: string | null;
  };
  const days = new Set(state.matchDays.map((d) => d.id));
  if (
    !state.games.every(
      (g) =>
        days.has(g.matchDayId ?? state.activeMatchDayId ?? '') &&
        isValidRound(g, state.savedPlayers),
    )
  )
    return false;
  try {
    for (const id of days)
      calculateRoundBalances(
        state.savedPlayers,
        state.games.filter(
          (g) => (g.matchDayId ?? state.activeMatchDayId) === id,
        ),
      );
  } catch {
    return false;
  }
  return true;
}
export function validateStoredValue(key: string, value: unknown): boolean {
  if (key === 'schafkopfrechner-sync-conflict-backup')
    return (
      record(value) &&
      value.schemaVersion === 1 &&
      text(value.ownerId) &&
      text(value.savedAt) &&
      Number.isSafeInteger(value.remoteVersion) &&
      validCloudSnapshot(value.local) &&
      validCloudSnapshot(value.remote)
    );
  if (key === 'schafkopfrechner-sync-restore')
    return (
      record(value) &&
      value.schemaVersion === 1 &&
      text(value.ownerId) &&
      (value.phase === 'pending' || value.phase === 'complete') &&
      Number.isSafeInteger(value.remoteVersion) &&
      text(value.remoteBaseline) &&
      validCloudSnapshot(value.before) &&
      validCloudSnapshot(value.after)
    );
  if (key === 'schafkopfrechner:mvp-game-state')
    return (
      record(value) &&
      value.schemaVersion === 1 &&
      text(value.savedAt) &&
      validGameSnapshot(value)
    );
  if (
    !record(value) ||
    !record(value.state) ||
    (value.version !== undefined && value.version !== 0)
  )
    return false;
  if (key === 'schafkopfrechner-players') return validSavedPlayers(value.state);
  if (key === 'schafkopfrechner-match-days') return validMatchDays(value.state);
  if (key === 'schafkopfrechner-games')
    return (
      validLegacyGames(value.state.games) &&
      validGameSnapshot({
        currentTable: null,
        players: [],
        rounds: [],
        balances: [],
        settlements: [],
        activeGame: false,
        ...value.state,
      })
    );
  return false;
}

/** Complete settings introduced by newer app versions without modifying round results. */
export function normalizeRestoredTables<
  T extends {
    currentTable: GameTable | null;
    rounds: GameRound[];
    archivedGameDays?: ArchivedGameDay[];
  },
>(state: T): T {
  const normalizeTable = (table: GameTable) => ({
    ...table,
    settings: normalizeTableSettings(table.settings),
  });
  const normalizeRounds = (rounds: GameRound[]) =>
    rounds.map((round) => ({
      ...round,
      settingsSnapshot: normalizeTableSettings(round.settingsSnapshot),
    }));
  return {
    ...state,
    currentTable: state.currentTable
      ? normalizeTable(state.currentTable)
      : null,
    rounds: normalizeRounds(state.rounds),
    ...(state.archivedGameDays
      ? {
          archivedGameDays: state.archivedGameDays.map((day) => ({
            ...day,
            table: normalizeTable(day.table),
            rounds: normalizeRounds(day.rounds),
          })),
        }
      : {}),
  };
}
