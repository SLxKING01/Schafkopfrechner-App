import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultTableSettings } from '../constants/tableSettings';
import { reliableStorage } from '../storage/reliableStorage';
import { validGameSnapshot } from '../storage/validateGameState';
import { useGameStore } from '../store/gameStore';
import type { CreateRoundPayload } from '../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
} from '../utils/accounting';
import { buildGameOverview } from '../utils/gameOverview';
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
const deposit = (): CreateRoundPayload => ({
  winnerId: '',
  winnerIds: [],
  loserIds: ['a', 'b', 'c', 'd'],
  amount: 2,
  gameType: 'stock',
  stockAction: 'deposit',
});
const payout = (): CreateRoundPayload => ({
  winnerId: 'a',
  winnerIds: ['a', 'b'],
  loserIds: ['c', 'd'],
  amount: 0.4,
  gameType: 'rufspiel',
  stockAction: 'payout',
  tariffOptions: { ...emptyTariffOptions },
});
beforeEach(() => {
  useGameStore.setState({
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
    archivedGameDays: [],
  });
  const settings = createDefaultTableSettings();
  settings.games.stock.enabled = true;
  useGameStore.getState().createTable('Stock', players, settings);
});
const amounts = () =>
  useGameStore.getState().balances.map((balance) => balance.amount);
it('debits all four equally and includes the held stock in the balanced ledger', () => {
  expect(useGameStore.getState().addRound(deposit())).toBe(true);
  expect(amounts()).toEqual([-0.5, -0.5, -0.5, -0.5]);
  expect(getStockBalanceCents(useGameStore.getState().rounds)).toBe(200);
  expect(useGameStore.getState().settlements).toEqual([]);
  expect(useGameStore.getState().finishGameDay()).toBe(false);
});

it('preserves dealer and Leger for a pure Stock deposit, including its undo', () => {
  const store = useGameStore.getState();
  store.togglePlayerLeger('a');
  const dealer = useGameStore.getState().currentTable!.dealerId;
  expect(store.addRound({ ...deposit(), stockCompletesDeal: false })).toBe(
    true,
  );
  expect(useGameStore.getState().currentTable).toMatchObject({
    dealerId: dealer,
    placedLegerPlayerIds: ['a'],
  });
  store.togglePlayerLeger('b');
  expect(store.undoLastRound()).toBe(true);
  expect(useGameStore.getState().currentTable).toMatchObject({
    dealerId: dealer,
    placedLegerPlayerIds: ['a', 'b'],
  });
});

it('explicitly completes an unplayed deal on Stock deposit when requested', () => {
  const store = useGameStore.getState();
  store.togglePlayerLeger('a');
  expect(store.addRound({ ...deposit(), stockCompletesDeal: true })).toBe(true);
  expect(useGameStore.getState().currentTable).toMatchObject({
    dealerId: 'b',
    placedLegerPlayerIds: [],
  });
  expect(store.undoLastRound()).toBe(true);
  expect(useGameStore.getState().currentTable).toMatchObject({
    dealerId: 'a',
    placedLegerPlayerIds: ['a'],
  });
});
it('pays the whole accumulated pot 50/50 on top of the ordinary Sauspiel win', () => {
  const store = useGameStore.getState();
  expect(store.addRound(deposit())).toBe(true);
  expect(store.addRound(deposit())).toBe(true);
  expect(store.addRound(payout())).toBe(true);
  expect(getStockBalanceCents(useGameStore.getState().rounds)).toBe(0);
  expect(amounts()).toEqual([1.2, 1.2, -1.2, -1.2]);
  expect(store.finishGameDay()).toBe(true);
  expect(
    useGameStore.getState().archivedGameDays[0].rounds[2].stockAction,
  ).toBe('payout');
});
it('undoes payouts and deposits without losing the pot or double-crediting winners', () => {
  const store = useGameStore.getState();
  store.addRound(deposit());
  store.addRound(payout());
  expect(store.undoLastRound()).toBe(true);
  expect(amounts()).toEqual([-0.5, -0.5, -0.5, -0.5]);
  expect(getStockBalanceCents(useGameStore.getState().rounds)).toBe(200);
  expect(store.addRound(payout())).toBe(true);
  expect(amounts()).toEqual([0.7, 0.7, -0.7, -0.7]);
  store.undoLastRound();
  expect(store.undoLastRound()).toBe(true);
  expect(getStockBalanceCents(useGameStore.getState().rounds)).toBe(0);
  expect(amounts()).toEqual([0, 0, 0, 0]);
});
it('replays later payouts after corrections and rejects a correction that empties their funding', () => {
  const store = useGameStore.getState();
  store.addRound(deposit());
  const id = useGameStore.getState().rounds[0].id;
  store.addRound(payout());
  expect(store.updateRound(id, { ...payout(), stockAction: undefined })).toBe(
    false,
  );
  expect(
    store.updateRound(useGameStore.getState().rounds[1].id, {
      ...payout(),
      winnerId: 'c',
      winnerIds: ['c', 'd'],
      loserIds: ['a', 'b'],
    }),
  ).toBe(true);
  expect(amounts()).toEqual([-0.7, -0.7, 0.7, 0.7]);
});
it('rejects empty-pot payouts, solo payouts, incomplete contributors and incorrect deposits', () => {
  const store = useGameStore.getState();
  expect(store.addRound(payout())).toBe(false);
  expect(store.addRound({ ...deposit(), amount: 1 })).toBe(false);
  expect(store.addRound({ ...deposit(), loserIds: ['a', 'b', 'c'] })).toBe(
    false,
  );
  store.addRound(deposit());
  expect(store.addRound({ ...payout(), gameType: 'solo' })).toBe(false);
  expect(store.addRound(payout())).toBe(true);
  expect(store.addRound(payout())).toBe(false);
});
it('accepts a persisted open pot and rejects forged balances or a closed table with remaining stock', () => {
  useGameStore.getState().addRound(deposit());
  const snapshot = JSON.parse(JSON.stringify(useGameStore.getState()));
  expect(validGameSnapshot(snapshot)).toBe(true);
  expect(
    validGameSnapshot({
      ...snapshot,
      balances: snapshot.balances.map((balance: { playerId: string }) => ({
        ...balance,
        amount: 0,
      })),
    }),
  ).toBe(false);
  expect(
    validGameSnapshot({
      ...snapshot,
      activeGame: false,
      currentTable: { ...snapshot.currentTable, isActive: false },
    }),
  ).toBe(false);
  expect(calculateRoundBalances(players, snapshot.rounds)).toEqual(
    snapshot.balances,
  );
  useGameStore.getState().addRound(payout());
  expect(
    validGameSnapshot(JSON.parse(JSON.stringify(useGameStore.getState()))),
  ).toBe(true);
});

it('restores a funded pot from persistent storage and pays it out once', async () => {
  useGameStore.getState().addRound(deposit());
  await useGameStore.getState().persistGame();
  await reliableStorage.flush();
  const saved = await AsyncStorage.getItem('schafkopfrechner-games');
  useGameStore.setState({
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
  });
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', saved!);
  await useGameStore.persist.rehydrate();
  expect(getStockBalanceCents(useGameStore.getState().rounds)).toBe(200);
  expect(amounts()).toEqual([-0.5, -0.5, -0.5, -0.5]);
  expect(useGameStore.getState().addRound(payout())).toBe(true);
  expect(amounts()).toEqual([0.7, 0.7, -0.7, -0.7]);
  expect(useGameStore.getState().addRound(payout())).toBe(false);
});

it('refunds remaining Stock to its four contributors when closing', () => {
  const store = useGameStore.getState();
  store.addRound(deposit());
  store.addRound(deposit());
  expect(store.finishGameDay('refund')).toBe(true);
  expect(amounts()).toEqual([0, 0, 0, 0]);
  const state = useGameStore.getState();
  expect(state.rounds.at(-1)).toMatchObject({
    stockAction: 'refund',
    amount: 4,
  });
  expect(getStockBalanceCents(state.rounds)).toBe(0);
  expect(state.activeGame).toBe(false);
  expect(validGameSnapshot(JSON.parse(JSON.stringify(state)))).toBe(true);
});

it('atomically carries Stock to a new table with the same four players and survives restart', async () => {
  const store = useGameStore.getState();
  store.addRound(deposit());
  const oldId = useGameStore.getState().currentTable!.id;
  expect(store.finishGameDay('carry')).toBe(true);
  let state = useGameStore.getState();
  expect(state.currentTable!.id).not.toBe(oldId);
  expect(state.activeGame).toBe(true);
  expect(state.players).toEqual(players);
  expect(state.archivedGameDays[0].rounds.at(-1)?.stockAction).toBe('carryOut');
  expect(
    state.archivedGameDays[0].balances.map((balance) => balance.amount),
  ).toEqual([0, 0, 0, 0]);
  expect(getStockBalanceCents(state.rounds)).toBe(200);
  expect(state.rounds[0].stockAction).toBe('carryIn');
  expect(state.undoLastRound()).toBe(false);
  expect(state.updateRound(state.rounds[0].id, deposit())).toBe(false);
  expect(validGameSnapshot(JSON.parse(JSON.stringify(state)))).toBe(true);
  await reliableStorage.flush();
  const saved = await AsyncStorage.getItem('schafkopfrechner-games');
  useGameStore.setState({
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
    archivedGameDays: [],
  });
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', saved!);
  await useGameStore.persist.rehydrate();
  state = useGameStore.getState();
  expect(state.archivedGameDays[0].table.id).toBe(oldId);
  expect(getStockBalanceCents(state.rounds)).toBe(200);
  expect(state.addRound(payout())).toBe(true);
  expect(amounts()).toEqual([0.7, 0.7, -0.7, -0.7]);
});

it('excludes Stock bookings from rounds, favorite games and win/loss statistics', () => {
  const store = useGameStore.getState();
  const overview = () =>
    buildGameOverview({
      ...useGameStore.getState(),
      games: [],
      savedPlayers: [],
      matchDays: [],
      activeMatchDayId: null,
    });
  store.addRound(deposit());
  store.addRound(deposit());
  expect(overview()).toMatchObject({
    rounds: [],
    todayRounds: 0,
    favoriteType: '–',
    playerStats: [],
  });
  store.addRound(payout());
  expect(overview().rounds).toHaveLength(1);
  expect(overview().favoriteType).toBe('Rufspiel');
  expect(overview().playerStats.map(({ rounds }) => rounds)).toEqual([
    1, 1, 1, 1,
  ]);
  expect(
    overview().playerStats.map(({ wins, losses }) => [wins, losses]),
  ).toEqual([
    [1, 0],
    [1, 0],
    [0, 1],
    [0, 1],
  ]);
});
