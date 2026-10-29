import {
  createStatisticsTable,
  groupStatistics,
  sauspielTeams,
  type StatisticsSourceRound,
  statisticsSubjects,
  subjectEntries,
  summarizeStatistics,
  tableTrend,
} from '../utils/statistics';

const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id.toUpperCase(),
}));
function round(
  id: string,
  overrides: Partial<StatisticsSourceRound> = {},
): StatisticsSourceRound {
  return {
    id,
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    amount: 0.4,
    gameType: 'rufspiel',
    declarerId: 'a',
    partnerId: 'b',
    suit: 'eichel',
    createdAt: `2026-10-29T12:00:${id.padStart(2, '0')}Z`,
    ...overrides,
  };
}
function table(rounds: StatisticsSourceRound[], id = 't') {
  return createStatisticsTable(
    id,
    id,
    players,
    rounds,
    { kind: 'active' },
    'id',
  );
}

it('counts actual Sauspiel partners in either order including losses, never the opponents', () => {
  const t = table([
    round('1'),
    round('2', {
      declarerId: 'b',
      partnerId: 'a',
      winnerId: 'c',
      winnerIds: ['c', 'd'],
      loserIds: ['a', 'b'],
      amount: 0.8,
    }),
    round('3', { declarerId: undefined, partnerId: undefined }),
  ]);
  const result = sauspielTeams(t);
  expect(result).toMatchObject({ total: 3, known: 2 });
  expect(result.teams).toHaveLength(1);
  expect(result.teams[0]).toMatchObject({
    ids: ['a', 'b'],
    wins: 1,
    balance: -40,
    summary: { count: 2 },
  });
});
it('keeps Stock bookings and payout shares out of played metrics and pure trends', () => {
  const t = table([
    round('1', {
      stockAction: 'deposit',
      winnerId: '',
      winnerIds: [],
      loserIds: ['a', 'b', 'c', 'd'],
      amount: 2,
    }),
    round('2', { stockAction: 'payout' }),
    round('3', {
      stockAction: 'carryOut',
      winnerId: '',
      winnerIds: [],
      loserIds: ['a', 'b', 'c', 'd'],
      amount: 2,
    }),
  ]);
  expect(t.stockBookings).toBe(2);
  expect(t.rounds).toHaveLength(1);
  expect(summarizeStatistics(subjectEntries([t]))).toMatchObject({
    count: 1,
    value: 40,
  });
  expect(tableTrend(t).balances).toEqual({ a: 20, b: 20, c: -20, d: -20 });
});
it('splits cents with the same deterministic accounting and keeps every trend point balanced', () => {
  const t = table([round('1', { amount: 0.01 }), round('2', { amount: 0.03 })]);
  expect(t.rounds[0].deltas).toEqual({ a: 1, b: 0, c: -1, d: 0 });
  for (const point of tableTrend(t).points)
    expect(Object.values(point.balances).reduce((s, n) => s + n, 0)).toBe(0);
});
it('separates personal wins, self-declared results and known-data coverage', () => {
  const t = table([
    round('1'),
    round('2', {
      declarerId: undefined,
      partnerId: undefined,
      suit: undefined,
    }),
    round('3', {
      declarerId: 'c',
      partnerId: 'd',
      winnerId: 'c',
      winnerIds: ['c', 'd'],
      loserIds: ['a', 'b'],
    }),
  ]);
  const person = statisticsSubjects([t])[0];
  expect(summarizeStatistics(subjectEntries([t], person))).toMatchObject({
    count: 3,
    wins: 2,
    balance: 20,
    own: 1,
    ownWins: 1,
    knownDeclarers: 2,
    bonusKnown: 0,
  });
  expect(summarizeStatistics(subjectEntries([t]))).toMatchObject({
    count: 3,
    knownResults: 2,
    wins: 2,
    balance: 0,
  });
  expect(
    groupStatistics(subjectEntries([t]), (r) => r.suit ?? 'unknown').find(
      (g) => g.id === 'unknown',
    )?.summary.count,
  ).toBe(1);
});
it('counts Re as a subset of Kontra and missing bonus data as unknown', () => {
  const options = {
    laufende: 0,
    schneider: false,
    schwarz: false,
    stoss: 1,
    legerCount: 1,
    turboRamsch: false,
  };
  const t = table([
    round('1', { tariffOptions: options }),
    round('2', { tariffOptions: { ...options, stoss: 3, legerCount: 0 } }),
    round('3'),
  ]);
  expect(summarizeStatistics(subjectEntries([t]))).toMatchObject({
    count: 3,
    bonusKnown: 2,
    kontra: 2,
    re: 1,
    leger: 1,
  });
});
it('identifies the solo player on both a won and lost solo without inventing Sauspiel partners', () => {
  const t = table([
    round('1', {
      gameType: 'solo',
      declarerId: undefined,
      partnerId: undefined,
      winnerIds: ['a'],
      loserIds: ['b', 'c', 'd'],
      amount: 1.5,
    }),
    round('2', {
      gameType: 'wenz',
      declarerId: undefined,
      partnerId: undefined,
      winnerId: 'b',
      winnerIds: ['b', 'c', 'd'],
      loserIds: ['a'],
      amount: 1.5,
    }),
    round('3', { declarerId: undefined, partnerId: undefined }),
  ]);
  const a = statisticsSubjects([t])[0];
  expect(summarizeStatistics(subjectEntries([t], a))).toMatchObject({
    own: 2,
    ownWins: 1,
    knownDeclarers: 2,
  });
  expect(t.rounds[2].declarerId).toBeUndefined();
});
it('keeps equal local names separate across tables and joins only verified account identities', () => {
  const a = table([round('1')], 'a'),
    b = table([round('1')], 'b');
  expect(statisticsSubjects([a, b])).toHaveLength(8);
  a.players[0].userId = 'account';
  b.players[0].userId = 'account';
  const subjects = statisticsSubjects([a, b]);
  expect(subjects).toHaveLength(7);
  expect(
    subjectEntries(
      [a, b],
      subjects.find((p) => p.id === 'user:account'),
    ),
  ).toHaveLength(2);
});
it('preserves recorded round order instead of reordering corrections by timestamp, and counts sole-leader changes', () => {
  const t = table([
    round('1', {
      winnerIds: ['a'],
      loserIds: ['b', 'c', 'd'],
      amount: 0.03,
      gameType: 'solo',
      declarerId: undefined,
      partnerId: undefined,
      createdAt: '2026-10-29T15:00:00Z',
    }),
    round('2', {
      winnerId: 'b',
      winnerIds: ['b'],
      loserIds: ['a', 'c', 'd'],
      amount: 0.06,
      gameType: 'solo',
      declarerId: undefined,
      partnerId: undefined,
      createdAt: '2026-10-29T12:00:00Z',
    }),
  ]);
  const trend = tableTrend(t);
  expect(trend.points[1].source?.id).toBe('1');
  expect(trend.balances).toEqual({ a: 1, b: 5, c: -3, d: -3 });
  expect(trend.highs.a).toBe(3);
  expect(trend.lows.a).toBe(0);
  expect(trend.leadChanges).toBe(1);
});
