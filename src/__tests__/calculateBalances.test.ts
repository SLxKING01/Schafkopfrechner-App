import { createGame, players } from '../test/utils/testData';
import { calculateBalances } from '../utils/calculateBalances';

function getAmount(playerId: string, games = [createGame({})]) {
  return (
    calculateBalances(players, games).find(
      (balance) => balance.playerId === playerId,
    )?.amount ?? 0
  );
}

describe('calculateBalances', () => {
  it('calculates simple wins and losses', () => {
    const games = [
      createGame({ winnerId: 'max', loserIds: ['simon'], amount: 20 }),
    ];

    expect(getAmount('max', games)).toBe(20);
    expect(getAmount('simon', games)).toBe(-20);
  });

  it('splits losses across multiple losers', () => {
    const games = [
      createGame({
        winnerId: 'max',
        loserIds: ['simon', 'anna'],
        amount: 20,
      }),
    ];

    expect(getAmount('max', games)).toBe(20);
    expect(getAmount('simon', games)).toBe(-10);
    expect(getAmount('anna', games)).toBe(-10);
  });

  it('includes players without games with zero balance', () => {
    const balances = calculateBalances(players, []);

    expect(balances).toHaveLength(players.length);
    expect(balances.every((balance) => balance.amount === 0)).toBe(true);
  });

  it('handles rounding cases without losing cents', () => {
    const games = [
      createGame({
        winnerId: 'max',
        loserIds: ['simon', 'anna', 'lisa'],
        amount: 10,
      }),
    ];
    const balances = calculateBalances(players, games);
    const total = balances.reduce((sum, balance) => sum + balance.amount, 0);

    expect(getAmount('max', games)).toBe(10);
    expect(getAmount('simon', games)).toBe(-3.34);
    expect(getAmount('anna', games)).toBe(-3.33);
    expect(getAmount('lisa', games)).toBe(-3.33);
    expect(total).toBeCloseTo(0, 2);
  });
});
