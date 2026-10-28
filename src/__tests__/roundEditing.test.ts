import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultTableSettings } from '../constants/tableSettings';
import { reliableStorage } from '../storage/reliableStorage';
import { useGameStore } from '../store/gameStore';
import { emptyTariffOptions } from '../utils/roundTariff';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  isLocal: true,
}));
const blank = {
  currentTable: null,
  players: [],
  rounds: [],
  balances: [],
  settlements: [],
  archivedGameDays: [],
  activeGame: false,
  cloudOwnerId: null,
  localStateRestored: false,
};
beforeEach(async () => {
  await reliableStorage.flush();
  await AsyncStorage.clear();
  useGameStore.setState(blank);
  useGameStore.getState().createTable('Tarife', players);
});
const payload = () => ({
  winnerId: 'a',
  winnerIds: ['a', 'b'],
  loserIds: ['c', 'd'],
  amount: 0.4,
  gameType: 'rufspiel' as const,
  tariffOptions: { ...emptyTariffOptions },
});
it('edits against original tariffs without moving the current dealer or consuming next-round Leger', () => {
  const store = useGameStore.getState();
  expect(store.addRound(payload())).toBe(true);
  const original = useGameStore.getState().rounds[0];
  store.togglePlayerLeger('c');
  const dealer = useGameStore.getState().currentTable?.dealerId;
  const settings = createDefaultTableSettings();
  settings.games.rufspiel.value = 2;
  store.updateCurrentTableSettings(settings);
  expect(
    store.updateRound(original.id, {
      ...payload(),
      amount: 1,
      tariffOptions: { ...emptyTariffOptions, laufende: 3 },
    }),
  ).toBe(true);
  const state = useGameStore.getState();
  expect(state.rounds[0]).toMatchObject({
    id: original.id,
    createdAt: original.createdAt,
    amount: 1,
  });
  expect(state.rounds[0].settingsSnapshot.games.rufspiel.value).toBe(0.2);
  expect(state.currentTable).toMatchObject({
    dealerId: dealer,
    placedLegerPlayerIds: ['c'],
  });
  expect(state.balances.map((b) => b.amount)).toEqual([0.5, 0.5, -0.5, -0.5]);
});
it('rejects forged amounts/factors and protects closed rounds', () => {
  const store = useGameStore.getState();
  expect(store.addRound({ ...payload(), amount: 999 })).toBe(false);
  store.addRound(payload());
  const round = useGameStore.getState().rounds[0];
  expect(
    store.updateRound(round.id, {
      ...payload(),
      tariffOptions: { ...emptyTariffOptions, legerCount: 1 },
      amount: 0.8,
    }),
  ).toBe(false);
  store.finishGameDay();
  const closed = useGameStore.getState();
  expect(store.updateRound(round.id, { ...payload(), amount: 0.5 })).toBe(
    false,
  );
  expect(store.undoLastRound()).toBe(false);
  expect(useGameStore.getState().archivedGameDays).toEqual(
    closed.archivedGameDays,
  );
});
it.each(
  [['unknown'], ['a', 'a'], ['a', 'b', 'c', 'd', 'unknown']].map((ids) => [
    ids,
  ]),
)(
  'rejects invalid player coins %j when correcting a round',
  (legerPlayerIds) => {
    const store = useGameStore.getState();
    store.addRound(payload());
    const original = useGameStore.getState().rounds[0];
    expect(
      store.updateRound(original.id, {
        ...payload(),
        legerPlayerIds,
        amount: 0.8,
        tariffOptions: { ...emptyTariffOptions, legerCount: 1 },
      }),
    ).toBe(false);
    expect(useGameStore.getState().rounds[0]).toEqual(original);
  },
);
it('restores the consumed dealer/Leger/Turbo snapshot after restart even after seat reordering', async () => {
  const store = useGameStore.getState();
  store.togglePlayerLeger('a');
  store.setTurboRamsch(true);
  expect(
    store.addRound({
      ...payload(),
      amount: 1.6,
      tariffOptions: {
        ...emptyTariffOptions,
        legerCount: 1,
        turboRamsch: true,
      },
    }),
  ).toBe(true);
  store.setPlayerOrder(['a', 'd', 'c', 'b']);
  store.togglePlayerLeger('d');
  store.setTurboRamsch(false);
  await store.persistGame();
  await reliableStorage.flush();
  const saved = await AsyncStorage.getItem('schafkopfrechner-games');
  useGameStore.setState(blank);
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', saved!);
  await useGameStore.persist.rehydrate();
  expect(useGameStore.getState().undoLastRound()).toBe(true);
  const state = useGameStore.getState();
  expect(state.rounds).toHaveLength(0);
  expect(state.balances.every((b) => b.amount === 0)).toBe(true);
  expect(state.currentTable).toMatchObject({
    dealerId: 'a',
    placedLegerPlayerIds: ['a'],
    turboRamschEnabled: true,
  });
  expect(state.players.map((p) => p.id)).toEqual(['a', 'd', 'c', 'b']);
});
it('keeps old manual total-gain rounds editable without reinterpreting their amounts', () => {
  const store = useGameStore.getState();
  store.addRound({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 10,
    gameType: 'rufspiel',
  });
  const round = useGameStore.getState().rounds[0];
  expect(
    store.updateRound(round.id, {
      winnerId: 'a',
      loserIds: ['b'],
      amount: 12,
      gameType: 'rufspiel',
    }),
  ).toBe(true);
  expect(useGameStore.getState().balances.map((b) => b.amount)).toEqual([
    12, -12, 0, 0,
  ]);
});
