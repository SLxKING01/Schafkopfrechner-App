import { calculateGameSettlements } from '../services/game/settlementEngine';
import {
  calculateMoneyTransfers,
  calculateRoundBalances,
  toSafeCents,
} from '../utils/accounting';
import { calculateBalances } from '../utils/calculateBalances';
import { calculateSettlements } from '../utils/calculateSettlements';

const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id }));

it.each([NaN, Infinity, -Infinity, 0.001, 1.005, Number.MAX_VALUE])(
  'rejects amounts that cannot represent whole safe cents: %s',
  (amount) => {
    expect(toSafeCents(amount)).toBeNull();
  },
);

it('accepts normal floating point noise as exact cents', () => {
  expect(toSafeCents(0.1 + 0.2)).toBe(30);
  expect(toSafeCents(0.2 * 16 * 2)).toBe(640);
  expect(toSafeCents(-0.3)).toBe(-30);
});

it('keeps every cent when one cent is shared among three losers', () => {
  const result = calculateRoundBalances(players, [
    { winnerId: 'a', loserIds: ['b', 'c', 'd'], amount: 0.01 },
  ]);
  expect(result).toEqual([
    { playerId: 'a', amount: 0.01 },
    { playerId: 'b', amount: -0.01 },
    { playerId: 'c', amount: 0 },
    { playerId: 'd', amount: 0 },
  ]);
});

it('balances hundreds of rounds and both settlement engines exactly in cents', () => {
  const games = Array.from({ length: 500 }, (_, index) => ({
    id: `${index}`,
    createdAt: 'now',
    winnerId: players[index % players.length].id,
    loserIds: players
      .filter((_, seat) => seat !== index % players.length)
      .map(({ id }) => id),
    amount: (((index * 137) % 10001) + 1) / 100,
  }));
  for (const balances of [
    calculateBalances(players, games),
    calculateRoundBalances(players, games, 'id'),
  ]) {
    expect(
      balances.reduce((total, { amount }) => total + toSafeCents(amount)!, 0),
    ).toBe(0);
    for (const payments of [
      calculateSettlements(balances),
      calculateGameSettlements(balances),
    ]) {
      const after = new Map(
        balances.map(({ playerId, amount }) => [
          playerId,
          toSafeCents(amount)!,
        ]),
      );
      for (const payment of payments) {
        expect(payment.fromPlayerId).not.toBe(payment.toPlayerId);
        const cents = toSafeCents(payment.amount)!;
        expect(cents).toBeGreaterThan(0);
        after.set(
          payment.fromPlayerId,
          after.get(payment.fromPlayerId)! + cents,
        );
        after.set(payment.toPlayerId, after.get(payment.toPlayerId)! - cents);
      }
      expect([...after.values()]).toEqual([0, 0, 0, 0]);
    }
  }
});

it.each(
  [
    [
      { playerId: 'a', amount: 1 },
      { playerId: 'b', amount: -0.9 },
    ],
    [
      { playerId: 'a', amount: Infinity },
      { playerId: 'b', amount: -1 },
    ],
    [
      { playerId: 'a', amount: 1 },
      { playerId: 'a', amount: -1 },
    ],
    [
      { playerId: 'a', amount: 0.001 },
      { playerId: 'b', amount: -0.001 },
    ],
  ].map((balances) => ({ balances })),
)(
  'refuses invalid balances instead of returning a partial settlement %#',
  ({ balances }) => {
    expect(() => calculateMoneyTransfers(balances)).toThrow();
    expect(() => calculateGameSettlements(balances)).toThrow();
  },
);

// Independent oracle: a zero-sum group of k nonzero balances needs k−1
// payments. Find the partition with the largest number of zero-sum groups.
function minimumByPartitions(values: number[]): number {
  const nonzero = values.filter((n) => n !== 0);
  if (!nonzero.length) return 0;
  let best = nonzero.length - 1;
  for (let mask = 1; mask < 2 ** nonzero.length; mask += 2) {
    const group = nonzero.filter((_, i) => mask & (1 << i));
    if (group.reduce((sum, n) => sum + n, 0) !== 0) continue;
    const rest = nonzero.filter((_, i) => !(mask & (1 << i)));
    best = Math.min(best, group.length - 1 + minimumByPartitions(rest));
  }
  return best;
}
it('finds exact matching subgroups instead of producing an unnecessary payment', () => {
  const balances = [5, 3, -3, -5, 0].map((amount, i) => ({
    playerId: String(i),
    amount,
  }));
  const payments = calculateMoneyTransfers(balances);
  expect(payments).toHaveLength(2);
  expect(payments).toEqual([
    { fromPlayerId: '2', toPlayerId: '1', amount: 3 },
    { fromPlayerId: '3', toPlayerId: '0', amount: 5 },
  ]);
  expect(calculateMoneyTransfers([...balances].reverse(), 'id')).toEqual(
    calculateMoneyTransfers(balances, 'id'),
  );
});
it('matches exhaustive zero-sum partitions and clears each balance for 625 five-player cent ledgers', () => {
  for (let encoded = 0; encoded < 625; encoded++) {
    let remaining = encoded;
    const values = Array.from({ length: 4 }, () => {
      const value = (remaining % 5) - 2;
      remaining = Math.floor(remaining / 5);
      return value;
    });
    values.push(-values.reduce((sum, n) => sum + n, 0));
    const payments = calculateMoneyTransfers(
      values.map((cents, i) => ({ playerId: String(i), amount: cents / 100 })),
    );
    expect(payments).toHaveLength(minimumByPartitions(values));
    const after = [...values];
    for (const payment of payments) {
      expect(payment.amount).toBeGreaterThan(0);
      expect(payment.fromPlayerId).not.toBe(payment.toPlayerId);
      const from = Number(payment.fromPlayerId);
      const to = Number(payment.toPlayerId);
      expect(values[from]).toBeLessThan(0);
      expect(values[to]).toBeGreaterThan(0);
      after[from] += toSafeCents(payment.amount)!;
      after[to] -= toSafeCents(payment.amount)!;
    }
    expect(after.every((cents) => cents === 0)).toBe(true);
  }
});
