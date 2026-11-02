import { createDefaultTableSettings } from '../constants/tableSettings';
import type { GameTable, Player, Settlement } from '../types/game';
import { createSettlementExport, exportMoney } from '../utils/settlementExport';

const players: Player[] = [
  {
    id: 'a-private',
    name: 'Alexandra mit sehr langem Namen',
    isLocal: false,
    userId: 'private-account',
  },
  { id: 'b-private', name: 'Bärbel', isLocal: true },
  { id: 'c-private', name: 'Chris', isLocal: true },
];
const table: GameTable = {
  id: 'private-table',
  hashCode: 'private-code',
  name: 'Freitagsrunde',
  isActive: false,
  createdAt: '2026-11-01T18:00:00Z',
  settings: createDefaultTableSettings(),
  interimPayments: [
    {
      id: 'interim',
      fromPlayerId: 'b-private',
      toPlayerId: 'a-private',
      amount: 2,
      createdAt: '2026-11-01T19:00:00Z',
    },
    {
      id: 'void',
      fromPlayerId: 'b-private',
      toPlayerId: 'a-private',
      amount: 1,
      createdAt: '2026-11-01T19:00:00Z',
      voidedAt: '2026-11-01T19:01:00Z',
    },
  ],
};
const balances = [
  { playerId: 'a-private', amount: 10.01 },
  { playerId: 'b-private', amount: -6 },
  { playerId: 'c-private', amount: -4.01 },
];
const plan: Settlement[] = [
  {
    id: 'first',
    fromPlayerId: 'b-private',
    toPlayerId: 'a-private',
    amount: 4,
    isPaid: true,
  },
  {
    id: 'second',
    fromPlayerId: 'c-private',
    toPlayerId: 'a-private',
    amount: 4.01,
    isPaid: false,
  },
];

it('exports the saved plan, separates paid transfers and accounts for non-voided interim payments', () => {
  const before = JSON.stringify({ table, players, balances, plan });
  const data = createSettlementExport(table, players, balances, plan, null);
  expect(data.balances.map((b) => b.amount)).toEqual([8.01, -4, -4.01]);
  expect(data.openPayments).toEqual([
    { from: 'Chris', to: players[0].name, amount: 4.01 },
  ]);
  expect(data.paidPayments).toEqual([
    { from: 'Bärbel', to: players[0].name, amount: 4 },
  ]);
  expect(data.interimPayments).toEqual([
    { from: 'Bärbel', to: players[0].name, amount: 2 },
  ]);
  expect(JSON.stringify({ table, players, balances, plan })).toBe(before);
  const serialized = JSON.stringify(data);
  for (const secret of [
    'private-account',
    'a-private',
    'private-table',
    'private-code',
    'settings',
    'playerId',
    'isLocal',
  ])
    expect(serialized).not.toContain(secret);
});

it('handles fully paid plans and zero-payment evenings without generating new payment requests', () => {
  expect(
    createSettlementExport(
      table,
      players,
      balances,
      plan.map((p) => ({ ...p, isPaid: true })),
      null,
    ).openPayments,
  ).toEqual([]);
  const zero = createSettlementExport(
    { ...table, interimPayments: [] },
    players,
    balances.map((b) => ({ ...b, amount: 0 })),
    [],
    null,
  );
  expect(zero.openPayments).toEqual([]);
  expect(zero.balances.every((p) => p.amount === 0)).toBe(true);
});

it('rejects active tables and missing or invalid accounting data rather than exporting misleading names or amounts', () => {
  expect(() =>
    createSettlementExport(
      { ...table, isActive: true },
      players,
      balances,
      plan,
      null,
    ),
  ).toThrow('abschließen');
  expect(() =>
    createSettlementExport(table, players.slice(0, 2), balances, plan, null),
  ).toThrow('unvollständig');
  expect(() =>
    createSettlementExport(
      table,
      players,
      balances,
      [{ ...plan[0], fromPlayerId: 'unknown' }],
      null,
    ),
  ).toThrow('Spielername');
  expect(() =>
    createSettlementExport(
      table,
      players,
      balances,
      [{ ...plan[0], amount: NaN }],
      null,
    ),
  ).toThrow('ungültig');
});

it('keeps signed amounts, cents, full names and the snapshot time', () => {
  const data = createSettlementExport(
    table,
    players,
    balances,
    plan,
    '2026-11-01T20:00:00Z',
    '2026-11-01T20:01:00Z',
  );
  expect(data.generatedAt).toBe('2026-11-01T20:01:00Z');
  expect(data.balances[0].name).toBe(players[0].name);
  expect(exportMoney(8.01, true)).toBe('+8,01 €');
  expect(exportMoney(-4.01, true)).toBe('-4,01 €');
  expect(exportMoney(0, true)).toBe('0,00 €');
});
