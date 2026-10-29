import { createDefaultTableSettings } from '../constants/tableSettings';
import { calculateGameSettlements } from '../services/game/settlementEngine';
import type { ArchivedGameDay, GameRound, Player } from '../types/game';
import { calculateRoundBalances } from '../utils/accounting';
import { buildGameOverview, formatOverviewMoney } from '../utils/gameOverview';

const players: Player[] = [
  { id: 'z', name: 'Zoe', isLocal: true },
  { id: 'a', name: 'Anna', isLocal: true },
  { id: 'b', name: 'Ben', isLocal: true },
  { id: 'c', name: 'Chris', isLocal: true },
];
const now = new Date(2026, 9, 26, 15);
function day(id: string, amount = 0.01): ArchivedGameDay {
  const rounds: GameRound[] = [
    {
      id: 'round',
      tableId: id,
      winnerId: 'b',
      loserIds: ['z', 'a'],
      amount,
      gameType: 'rufspiel',
      settingsSnapshot: createDefaultTableSettings(),
      createdAt: now.toISOString(),
    },
  ];
  const balances = calculateRoundBalances(players, rounds, 'id');
  return {
    table: {
      id,
      name: id,
      createdAt: now.toISOString(),
      hashCode: id,
      isActive: false,
      settings: createDefaultTableSettings(),
    },
    players,
    rounds,
    balances,
    settlements: calculateGameSettlements(balances),
    completedAt: now.toISOString(),
  };
}
function empty() {
  return {
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
    activeGame: false,
    games: [],
    savedPlayers: [],
    matchDays: [],
    activeMatchDayId: null,
  } as Parameters<typeof buildGameOverview>[0];
}
it('shows real zero values for an empty installation', () => {
  const value = buildGameOverview(empty(), now);
  expect(value).toMatchObject({
    rounds: [],
    payments: [],
    playerStats: [],
    completedTables: 0,
    todayRounds: 0,
    roundValueCents: 0n,
    openPaymentCents: 0n,
    favoriteType: '–',
    activeTarget: null,
  });
});
it('counts an archived table once even when it is still the current table', () => {
  const saved = day('table');
  const result = buildGameOverview(
    {
      ...empty(),
      currentTable: saved.table,
      players,
      rounds: saved.rounds,
      balances: saved.balances,
      settlements: saved.settlements,
      archivedGameDays: [saved],
    },
    now,
  );
  expect(result.rounds).toHaveLength(1);
  expect(result.statisticsTables).toHaveLength(1);
  expect(result.statisticsTables[0].rounds).toHaveLength(1);
  expect(result.completedTables).toBe(1);
  expect(result.openPaymentCents).toBe(1n);
  expect(result.playerStats.find((p) => p.name === 'Anna')).toMatchObject({
    rounds: 1,
    losses: 1,
    wins: 0,
    balanceCents: -1,
  });
  expect(result.playerStats.find((p) => p.name === 'Zoe')?.balanceCents).toBe(
    0,
  );
  expect(result.playerStats.some((p) => p.name === 'Chris')).toBe(false);
});
it('does not turn live balances into final payment requests', () => {
  const live = day('live', 2.4);
  const result = buildGameOverview(
    {
      ...empty(),
      currentTable: { ...live.table, isActive: true },
      players,
      rounds: live.rounds,
      balances: live.balances,
      settlements: live.settlements,
      activeGame: true,
    },
    now,
  );
  expect(result.payments).toEqual([]);
  expect(result.roundValueCents).toBe(240n);
  expect(result.activeTarget).toEqual({ kind: 'active' });
  expect(result.rounds[0].participants).toBe(3);
});
it('uses archived paid state instead of stale current-copy payments', () => {
  const saved = day('table', 2.4);
  const paid = {
    ...saved,
    settlements: saved.settlements.map((s) => ({ ...s, isPaid: true })),
  };
  const result = buildGameOverview(
    {
      ...empty(),
      currentTable: saved.table,
      players,
      rounds: saved.rounds,
      settlements: saved.settlements,
      archivedGameDays: [paid],
    },
    now,
  );
  expect(result.payments).toEqual([]);
});
it('keeps older games and their original remainder-cent order without inventing payment statuses', () => {
  const result = buildGameOverview(
    {
      ...empty(),
      savedPlayers: players,
      activeMatchDayId: 'older',
      matchDays: [
        {
          id: 'older',
          name: 'Alter Abend',
          createdAt: now.toISOString(),
          isActive: true,
          isClosed: true,
        },
      ],
      games: [
        {
          id: 'old',
          winnerId: 'b',
          loserIds: ['z', 'a'],
          amount: 0.01,
          createdAt: now.toISOString(),
          gameTypeId: 'solo',
        },
      ],
    },
    now,
  );
  expect(result.rounds[0]).toMatchObject({
    gameType: 'Solo',
    target: { kind: 'legacy', matchDayId: 'older' },
  });
  expect(result.playerStats.find((p) => p.name === 'Zoe')?.balanceCents).toBe(
    -1,
  );
  expect(result.payments).toHaveLength(0);
});
it('sorts across evenings and counts today by local calendar date', () => {
  const old = day('old');
  old.rounds[0].createdAt = new Date(2026, 9, 25, 23, 59).toISOString();
  const recent = day('recent');
  const result = buildGameOverview(
    { ...empty(), archivedGameDays: [old, recent] },
    now,
  );
  expect(result.todayRounds).toBe(1);
  expect(result.rounds.map((r) => r.tableName)).toEqual(['recent', 'old']);
});
it('never merges equal names from separate tables and routes each payment to its own archive', () => {
  const result = buildGameOverview(
    { ...empty(), archivedGameDays: [day('one'), day('two')] },
    now,
  );
  expect(result.playerStats.filter((p) => p.name === 'Ben')).toHaveLength(2);
  expect(result.payments.map((p) => p.target)).toEqual([
    { kind: 'archive', tableId: 'one' },
    { kind: 'archive', tableId: 'two' },
  ]);
  expect(new Set(result.payments.map((p) => p.id)).size).toBe(2);
});
it('formats exact cent totals, including totals beyond a single safe-integer ledger', () => {
  expect(formatOverviewMoney(123456)).toBe('1.234,56 €');
  expect(formatOverviewMoney(-1)).toBe('-0,01 €');
  expect(formatOverviewMoney(18014398509481982n)).toBe(
    '180.143.985.094.819,82 €',
  );
});
