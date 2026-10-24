import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { calculateBalances } from '../utils/calculateBalances';
import { calculateSettlements } from '../utils/calculateSettlements';

jest.mock('../services/sync/syncGameTable', () => ({
  syncGameTable: jest.fn(),
}));
jest.mock('../services/sync/syncRounds', () => ({ syncRounds: jest.fn() }));
jest.mock('../services/sync/syncSettlements', () => ({
  syncSettlements: jest.fn(),
}));

it('keeps referenced offline players and their settlement, including after reload', async () => {
  const players = [
    { id: 'a', name: 'Anna' },
    { id: 'b', name: 'Ben' },
    { id: 'c', name: 'Unbenutzt' },
  ];
  usePlayerStore.setState({ players });
  useGameStore.setState({
    games: [
      {
        id: 'g',
        winnerId: 'a',
        loserIds: ['b'],
        amount: 10,
        createdAt: '2026-10-24',
      },
    ],
  });
  usePlayerStore.getState().removePlayer('a');
  usePlayerStore.getState().removePlayer('b');
  usePlayerStore.getState().removePlayer('c');
  await usePlayerStore.persist.rehydrate();
  expect(usePlayerStore.getState().players).toEqual(players.slice(0, 2));
  const balances = calculateBalances(
    usePlayerStore.getState().players,
    useGameStore.getState().games,
  );
  expect(balances).toEqual([
    { playerId: 'a', amount: 10 },
    { playerId: 'b', amount: -10 },
  ]);
  expect(calculateSettlements(balances)).toEqual([
    { fromPlayerId: 'b', toPlayerId: 'a', amount: 10 },
  ]);
});

it('retains missing participants in previously damaged data so debts do not disappear', () => {
  const balances = calculateBalances(
    [{ id: 'b', name: 'Ben' }],
    [
      {
        id: 'g',
        winnerId: 'deleted',
        loserIds: ['b'],
        amount: 10,
        createdAt: '2026-10-24',
      },
    ],
  );
  expect(balances.reduce((sum, entry) => sum + entry.amount, 0)).toBe(0);
  expect(calculateSettlements(balances)).toEqual([
    { fromPlayerId: 'b', toPlayerId: 'deleted', amount: 10 },
  ]);
});

it('saves and edits both offline winners without changing old single-winner records', () => {
  const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id }));
  usePlayerStore.setState({ players });
  useGameStore.setState({ games: [] });
  const input = {
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    amount: 10,
    gameTypeId: 'sauspiel',
    options: { laufende: 0, schneider: false, schwarz: false },
  };
  expect(useGameStore.getState().addGame(input)).toBe(true);
  const game = useGameStore.getState().games[0];
  expect(
    calculateBalances(players, [game]).map((entry) => entry.amount),
  ).toEqual([5, 5, -5, -5]);
  expect(
    useGameStore.getState().updateGame({
      ...game,
      winnerId: 'c',
      winnerIds: ['c', 'd'],
      loserIds: ['a', 'b'],
    }),
  ).toBe(true);
  expect(
    calculateBalances(players, useGameStore.getState().games).map(
      (entry) => entry.amount,
    ),
  ).toEqual([-5, -5, 5, 5]);
  usePlayerStore.getState().removePlayer('d');
  expect(usePlayerStore.getState().players).toHaveLength(4);
});
