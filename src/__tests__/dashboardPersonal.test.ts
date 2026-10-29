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
    players,
    rounds,
    { kind: 'active' },
    'id',
  );
}
it('never merges matching local names without an explicit selection at each table', () => {
  const tables = [table('one'), table('two')];
  expect(dashboardPersonal(tables, {})).toMatchObject({
    hasIdentity: false,
    unassigned: 2,
    summary: { count: 0, balance: 0 },
  });
  expect(dashboardPersonal(tables, { one: 'a' })).toMatchObject({
    hasIdentity: true,
    unassigned: 1,
    summary: { count: 1, balance: 20, wins: 1 },
  });
  expect(dashboardPersonal(tables, { one: 'a', two: 'a' })).toMatchObject({
    unassigned: 0,
    summary: { count: 2, balance: 40, wins: 2 },
  });
});
it('prefers the verified account seat and does not use mappings from another identity', () => {
  const t = table('one');
  t.players = t.players.map((p) =>
    p.id === 'b'
      ? { ...p, userId: 'my-account' }
      : p.id === 'c'
        ? { ...p, userId: 'other-account' }
        : p,
  );
  expect(
    dashboardPersonal([t], { one: 'd' }, 'my-account').memberships.get('one'),
  ).toBe('b');
  expect(dashboardPersonal([t], { one: 'c' }).hasIdentity).toBe(false);
  expect(dashboardPersonal([t], { one: 'gone' }).hasIdentity).toBe(false);
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
  expect(dashboardPersonal([t], { one: 'a' }).summary).toMatchObject({
    count: 2,
    wins: 1,
    balance: -20,
  });
});
it('does not double-count a corrected round and recomputes personal outcomes', () => {
  const before = dashboardPersonal([table('one')], { one: 'a' });
  const after = dashboardPersonal(
    [
      table('one', [
        { ...r, winnerId: 'c', winnerIds: ['c', 'd'], loserIds: ['a', 'b'] },
      ]),
    ],
    { one: 'a' },
  );
  expect(before.summary).toMatchObject({ count: 1, wins: 1, balance: 20 });
  expect(after.summary).toMatchObject({ count: 1, wins: 0, balance: -20 });
});
