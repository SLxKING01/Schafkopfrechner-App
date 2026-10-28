import { useGameStore } from '../store/gameStore';
import type { Player } from '../types/game';
import { getCurrentDealerId, getNextDealerId } from '../utils/dealerOrder';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
const players: Player[] = ['Anna', 'Berkay', 'Chris', 'Dani'].map(
  (name, index) => ({ id: `${index}`, name, isLocal: true }),
);

beforeEach(() => {
  useGameStore.setState({
    archivedGameDays: [],
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
  });
  useGameStore.getState().createTable('Spielabend', players);
});

it('preserves the current dealer on reorder and follows the new seats including wraparound', () => {
  const addRound = () =>
    expect(
      useGameStore.getState().addRound({
        winnerId: '0',
        loserIds: ['1'],
        amount: 0.2,
        gameType: 'rufspiel',
      }),
    ).toBe(true);
  addRound();
  const before = useGameStore.getState();
  expect(
    getCurrentDealerId(
      before.currentTable,
      before.players,
      before.rounds.length,
    ),
  ).toBe('1');
  expect(before.setPlayerOrder(['3', '1', '0', '2'])).toBe(true);
  let state = useGameStore.getState();
  expect(state.players.map(({ id }) => id)).toEqual(['3', '1', '0', '2']);
  expect(
    getCurrentDealerId(state.currentTable, state.players, state.rounds.length),
  ).toBe('1');
  expect(
    getNextDealerId(state.currentTable, state.players, state.rounds.length),
  ).toBe('0');
  expect(state.rounds).toEqual(before.rounds);
  expect(state.balances).toEqual(before.balances);
  for (const expected of ['0', '2', '3', '1']) {
    addRound();
    state = useGameStore.getState();
    expect(
      getCurrentDealerId(
        state.currentTable,
        state.players,
        state.rounds.length,
      ),
    ).toBe(expected);
  }
});

it.each([
  ['0', '0', '2', '3'],
  ['0', '1'],
  ['0', '1', '2', 'missing'],
])('rejects invalid orders %j', (...ids) => {
  const before = useGameStore.getState();
  expect(before.setPlayerOrder(ids)).toBe(false);
  expect(useGameStore.getState().players).toEqual(before.players);
});

it('supports saved tables without a dealer id', () => {
  const table = {
    ...useGameStore.getState().currentTable!,
    dealerId: undefined,
  };
  expect(getCurrentDealerId(table, players, 2)).toBe('2');
  useGameStore.setState({
    currentTable: table,
    rounds: [{ id: 'one' }, { id: 'two' }] as never,
  });
  expect(useGameStore.getState().setPlayerOrder(['3', '2', '1', '0'])).toBe(
    true,
  );
  const state = useGameStore.getState();
  expect(state.currentTable?.dealerId).toBe('2');
  expect(
    getNextDealerId(state.currentTable, state.players, state.rounds.length),
  ).toBe('1');
});
