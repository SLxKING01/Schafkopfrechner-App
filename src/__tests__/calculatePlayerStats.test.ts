import { createGame, players } from '../test/utils/testData';
import { calculatePlayerStats } from '../utils/calculatePlayerStats';

describe('calculatePlayerStats', () => {
  const games = [
    createGame({
      id: 'game-1',
      winnerId: 'max',
      loserIds: ['simon', 'anna'],
      amount: 20,
      gameTypeId: 'sauspiel',
    }),
    createGame({
      id: 'game-2',
      winnerId: 'simon',
      loserIds: ['max'],
      amount: 50,
      gameTypeId: 'solo',
    }),
    createGame({
      id: 'game-3',
      winnerId: 'max',
      loserIds: ['simon'],
      amount: 10,
      gameTypeId: 'sauspiel',
    }),
  ];

  it('calculates win rate correctly', () => {
    const maxStats = calculatePlayerStats(players, games).find(
      (stats) => stats.playerId === 'max',
    );

    expect(maxStats?.totalGames).toBe(3);
    expect(maxStats?.wins).toBe(2);
    expect(maxStats?.losses).toBe(1);
    expect(maxStats?.winRate).toBeCloseTo(66.666666, 3);
  });

  it('calculates favorite game type', () => {
    const maxStats = calculatePlayerStats(players, games).find(
      (stats) => stats.playerId === 'max',
    );

    expect(maxStats?.favoriteGameTypeId).toBe('sauspiel');
  });

  it('uses balances for total amount', () => {
    const stats = calculatePlayerStats(players, games);

    expect(stats.find((item) => item.playerId === 'max')?.totalAmount).toBe(
      -20,
    );
    expect(stats.find((item) => item.playerId === 'simon')?.totalAmount).toBe(
      30,
    );
    expect(stats.find((item) => item.playerId === 'anna')?.totalAmount).toBe(
      -10,
    );
    expect(stats.find((item) => item.playerId === 'lisa')?.totalAmount).toBe(0);
  });
});
