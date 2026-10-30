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
