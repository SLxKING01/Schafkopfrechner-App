import { planClosedTableCorrection } from '../services/game/closedTableCorrection';
import { createGameRound } from '../services/game/createRound';
import { createGameTable } from '../services/game/createTable';
import { validGameSnapshot } from '../storage/validateGameState';
import type { ArchivedGameDay, CreateRoundPayload } from '../types/game';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

const players = ['flo', 'simon'].map((id) => ({
  id,
  name: id,
  isLocal: true,
}));
const table = createGameTable({ name: 'Freitag', players });
const result: CreateRoundPayload = {
  winnerId: 'simon',
  loserIds: ['flo'],
  amount: 5,
  gameType: 'solo',
};
const round = createGameRound(table.id, result);
const payment = {
  id: 'original-payment',
  fromPlayerId: 'flo',
  toPlayerId: 'simon',
  amount: 5,
  isPaid: false,
};
const day: ArchivedGameDay = {
  table: { ...table, isActive: false },
  players,
  rounds: [round],
  balances: [
    { playerId: 'flo', amount: -5 },
    { playerId: 'simon', amount: 5 },
  ],
  settlements: [payment],
  completedAt: '2026-11-07T13:00:00.000Z',
};
const report = {
  id: 'report',
  payment_id: payment.id,
  action: 'report' as const,
  actor_id: 'flo',
  actor_name: 'Flo',
  player_name: 'Flo',
  delegated: false,
  occurred_at: '2026-11-07T13:10:00.000Z',
};

it('previews a €2 refund after a confirmed €5 payment and preserves the previous plan', () => {
  const correction = planClosedTableCorrection(
    day,
    round.id,
    { ...result, amount: 3 },
    [
      report,
      { ...report, id: 'confirm', action: 'confirm', actor_id: 'simon' },
    ],
  );
  expect(correction.pending).toBe(false);
  expect(correction.expectedEvent).toBe('confirm');
  expect(correction.day.rounds[0].id).toBe(round.id);
  expect(day.rounds[0].amount).toBe(5);
  expect(correction.day.settlements).toEqual([
    payment,
    expect.objectContaining({
      fromPlayerId: 'simon',
      toPlayerId: 'flo',
      amount: 2,
    }),
  ]);
  expect(correction.day.table.settlementRevisions?.[0]).toMatchObject({
    balances: day.balances,
    settlements: day.settlements,
    carriedPaymentIds: [payment.id],
  });
  expect(
    validGameSnapshot({
      currentTable: correction.day.table,
      players,
      rounds: correction.day.rounds,
      balances: correction.day.balances,
      settlements: correction.day.settlements,
      activeGame: false,
    }),
  ).toBe(true);
});

it('marks the preview as blocked while a reported payment is unconfirmed', () => {
  const correction = planClosedTableCorrection(
    day,
    round.id,
    { ...result, amount: 3 },
    [report],
  );
  expect(correction.pending).toBe(true);
  expect(correction.day.settlements).toEqual([
    expect.objectContaining({
      fromPlayerId: 'flo',
      toPlayerId: 'simon',
      amount: 3,
    }),
  ]);
});
