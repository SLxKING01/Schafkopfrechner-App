import { dashboardPersonal } from '../utils/dashboardPersonal';
import {
  createStatisticsTable,
  type StatisticsSourceRound,
} from '../utils/statistics';

const players = [
  { id: 'a', name: 'Simon' },
  { id: 'b', name: 'Flo' },
  { id: 'c', name: 'Berkay' },
  { id: 'd', name: 'Alessandro' },
];
const r: StatisticsSourceRound = {
  id: 'r',
  gameType: 'rufspiel',
  winnerId: 'a',
  winnerIds: ['a', 'b'],
  loserIds: ['c', 'd'],
  amount: 0.4,
  createdAt: '2026-10-29T12:00:00Z',
};
function table(id: string, rounds = [r]) {
  return createStatisticsTable(
    id,
    id,
    players.map((player) => ({ ...player })),
    rounds,
    { kind: 'active' },
    'id',
  );
}
it('uses only the authenticated account and never matches players by name', () => {
  const tables = [table('one'), table('two')];
  expect(dashboardPersonal(tables, 'my-account')).toMatchObject({
    hasIdentity: false,
    unassigned: 2,
    summary: { count: 0, balance: 0 },
  });
  tables[0].players[0].userId = 'my-account';
  tables[1].players[1].userId = 'my-account';
  expect(dashboardPersonal(tables, 'my-account')).toMatchObject({
    hasIdentity: true,
    summary: { count: 2, balance: 40, wins: 2 },
  });
  expect(dashboardPersonal(tables).hasIdentity).toBe(false);
});
it('does not use another account or ambiguous duplicate account seats', () => {
  const t = table('one');
  t.players[0].userId = 'other-account';
  expect(dashboardPersonal([t], 'my-account').hasIdentity).toBe(false);
  t.players[1].userId = 'my-account';
  expect(dashboardPersonal([t], 'my-account').memberships.get('one')).toBe('b');
  t.players[2].userId = 'my-account';
  expect(dashboardPersonal([t], 'my-account').hasIdentity).toBe(false);
});
it('excludes stock movements and the paid-out stock share while including won and lost rounds', () => {
  const t = table('one', [
    {
      ...r,
      id: 'stock',
      gameType: 'stock',
      stockAction: 'deposit',
      winnerId: '',
      winnerIds: [],
      loserIds: ['a', 'b', 'c', 'd'],
      amount: 2,
    },
    { ...r, id: 'paid-out', stockAction: 'payout' },
    {
      ...r,
      id: 'lost',
      winnerId: 'c',
      winnerIds: ['c', 'd'],
      loserIds: ['a', 'b'],
      amount: 0.8,
    },
  ]);
  t.players[0].userId = 'my-account';
  expect(dashboardPersonal([t], 'my-account').summary).toMatchObject({
    count: 2,
    wins: 1,
    balance: -20,
  });
});
it('does not double-count a corrected round and recomputes personal outcomes', () => {
  const initial = table('one');
  initial.players[0].userId = 'my-account';
  const before = dashboardPersonal([initial], 'my-account');
  const corrected = table('one', [
    { ...r, winnerId: 'c', winnerIds: ['c', 'd'], loserIds: ['a', 'b'] },
  ]);
  corrected.players[0].userId = 'my-account';
  const after = dashboardPersonal([corrected], 'my-account');
  expect(before.summary).toMatchObject({ count: 1, wins: 1, balance: 20 });
  expect(after.summary).toMatchObject({ count: 1, wins: 0, balance: -20 });
});
