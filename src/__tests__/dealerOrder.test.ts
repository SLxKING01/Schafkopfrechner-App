import AsyncStorage from '@react-native-async-storage/async-storage';

import { reliableStorage } from '../storage/reliableStorage';
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
        loserIds: ['1', '2', '3'],
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

it('switches only the current dealer and uses the new selection for future rounds', () => {
  const state = useGameStore.getState();
  state.addRound({
    gameType: 'solo',
    winnerId: '0',
    loserIds: ['1', '2', '3'],
    amount: 1.5,
    declarerId: '0',
  });
  state.togglePlayerLeger('1');
  state.setTurboRamsch(true);
  const before = useGameStore.getState();
  expect(before.setDealer(before.currentTable!.id, '2')).toBe(true);
  const after = useGameStore.getState();
  expect(after.currentTable).toEqual({ ...before.currentTable, dealerId: '2' });
  expect(after.rounds).toEqual(before.rounds);
  expect(after.balances).toEqual(before.balances);
  expect(after.players).toEqual(before.players);
  expect(after.settlements).toEqual(before.settlements);
  expect(
    getNextDealerId(after.currentTable, after.players, after.rounds.length),
  ).toBe('3');
  expect(
    after.addRound({
      gameType: 'solo',
      winnerId: '0',
      loserIds: ['1', '2', '3'],
      amount: 1.5,
      declarerId: '0',
    }),
  ).toBe(true);
  expect(useGameStore.getState().rounds[1].roundContext?.dealerIdBefore).toBe(
    '2',
  );
  expect(useGameStore.getState().currentTable!.dealerId).toBe('3');
  expect(useGameStore.getState().rounds[0]).toEqual(before.rounds[0]);
});
it('rejects unknown players, stale tables and closed tables without modifying the selection', () => {
  const state = useGameStore.getState();
  const before = state.currentTable;
  expect(state.setDealer(before!.id, 'missing')).toBe(false);
  expect(state.setDealer('another-table', '1')).toBe(false);
  expect(useGameStore.getState().currentTable).toEqual(before);
  state.finishGameDay();
  expect(state.setDealer(before!.id, '1')).toBe(false);
});
it('preserves the selected dealer after persisted store rehydration', async () => {
  const state = useGameStore.getState();
  expect(state.setDealer(state.currentTable!.id, '3')).toBe(true);
  await reliableStorage.flush();
  const raw = (await AsyncStorage.getItem('schafkopfrechner-games'))!;
  useGameStore.setState({
    currentTable: null,
    activeGame: false,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
  });
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', raw);
  await useGameStore.persist.rehydrate();
  expect(useGameStore.getState().currentTable!.dealerId).toBe('3');
  expect(
    getNextDealerId(
      useGameStore.getState().currentTable,
      useGameStore.getState().players,
      0,
    ),
  ).toBe('0');
});
