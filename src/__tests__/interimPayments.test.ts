import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureGameState } from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import {
  validCloudSnapshot,
  validGameSnapshot,
} from '../storage/validateGameState';
import { useGameStore } from '../store/gameStore';
import { seedLegacyRound } from '../testUtils/seedLegacyRound';
import { outstandingBalances, paymentRevision } from '../utils/interimPayments';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  isLocal: true,
}));
function revision() {
  const s = useGameStore.getState();
  return paymentRevision(s.currentTable!, s.balances);
}
function pay(amount: number, id = 'partial') {
  const s = useGameStore.getState();
  return s.recordInterimPayment(s.currentTable!.id, revision(), {
    id,
    fromPlayerId: 'b',
    toPlayerId: 'a',
    amount,
  });
}
function due() {
  const s = useGameStore.getState();
  return outstandingBalances(s.balances, s.currentTable?.interimPayments);
}
beforeEach(async () => {
  await reliableStorage.flush();
  useGameStore.setState({
    currentTable: null,
    activeGame: false,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
    games: [],
  });
  useGameStore.getState().createTable('Zwischenzahlung', players);
  seedLegacyRound({
    gameType: 'rufspiel',
    winnerId: 'a',
    loserIds: ['b'],
    amount: 10,
  });
});
afterEach(async () => {
  await reliableStorage.retryWrites();
  await reliableStorage.flush();
});
it('records a partial payment without changing rounds, rules, dealer, multipliers or game results', () => {
  useGameStore.getState().togglePlayerLeger('c');
  useGameStore.getState().setTurboRamsch(true);
  const before = structuredClone(useGameStore.getState().currentTable!);
  const rounds = structuredClone(useGameStore.getState().rounds);
  expect(pay(6)).toBe(true);
  const state = useGameStore.getState();
  expect(state.currentTable).toEqual({
    ...before,
    interimPayments: expect.any(Array),
  });
  expect(state.activeGame).toBe(true);
  expect(state.rounds).toEqual(rounds);
  expect(state.balances.map((b) => b.amount)).toEqual([10, -10, 0, 0]);
  expect(due().map((b) => b.amount)).toEqual([4, -4, 0, 0]);
  expect(state.settlements.map((p) => p.amount)).toEqual([4]);
  expect(pay(6)).toBe(true); // exact retry of same ID is idempotent
  expect(state.currentTable!.interimPayments).toHaveLength(1);
});
it('fully clears the remaining debt, continues with a new game, and closes without charging paid money again', () => {
  expect(pay(6)).toBe(true);
  const id = useGameStore.getState().currentTable!.id;
  expect(useGameStore.getState().settleInterimPayments(id, revision())).toBe(
    true,
  );
  expect(due().every((b) => b.amount === 0)).toBe(true);
  expect(useGameStore.getState().activeGame).toBe(true);
  expect(useGameStore.getState().rounds).toHaveLength(1);
  seedLegacyRound({
    gameType: 'rufspiel',
    winnerId: 'b',
    loserIds: ['a'],
    amount: 3,
  });
  expect(due().map((b) => b.amount)).toEqual([-3, 3, 0, 0]);
  expect(useGameStore.getState().finishGameDay()).toBe(true);
  const archived = useGameStore.getState().archivedGameDays[0];
  expect(archived.table.id).toBe(id);
  expect(archived.table.interimPayments).toHaveLength(2);
  expect(archived.rounds).toHaveLength(2);
  expect(archived.settlements).toEqual([
    expect.objectContaining({ fromPlayerId: 'a', toPlayerId: 'b', amount: 3 }),
  ]);
  expect(validGameSnapshot(useGameStore.getState())).toBe(true);
});
it('preserves actual payments when an old game is corrected or undone and allows payment reversal', () => {
  expect(pay(6)).toBe(true);
  const s = useGameStore.getState();
  expect(
    s.updateRound(s.rounds[0].id, {
      gameType: 'rufspiel',
      winnerId: 'a',
      loserIds: ['b'],
      amount: 2,
    }),
  ).toBe(true);
  expect(due().map((b) => b.amount)).toEqual([-4, 4, 0, 0]);
  expect(useGameStore.getState().undoLastRound()).toBe(true);
  expect(due().map((b) => b.amount)).toEqual([-6, 6, 0, 0]);
  expect(
    useGameStore.getState().voidInterimPayment(s.currentTable!.id, 'partial'),
  ).toBe(true);
  expect(due().every((b) => b.amount === 0)).toBe(true);
  expect(
    useGameStore.getState().currentTable!.interimPayments![0].voidedAt,
  ).toBeTruthy();
});
it.each([0, -1, 10.01, NaN, Infinity, 0.001])(
  'rejects invalid or excessive payment %s',
  (amount) => {
    expect(pay(amount)).toBe(false);
    expect(
      useGameStore.getState().currentTable!.interimPayments,
    ).toBeUndefined();
  },
);
it('rejects stale full and partial plans and writes to another or closed table', () => {
  const s = useGameStore.getState();
  const previous = revision();
  expect(pay(1)).toBe(true);
  expect(s.settleInterimPayments(s.currentTable!.id, previous)).toBe(false);
  expect(
    s.recordInterimPayment(s.currentTable!.id, previous, {
      id: 'stale',
      fromPlayerId: 'b',
      toPlayerId: 'a',
      amount: 1,
    }),
  ).toBe(false);
  expect(s.settleInterimPayments('other-table', revision())).toBe(false);
  useGameStore.getState().finishGameDay();
  expect(pay(1, 'closed')).toBe(false);
});
it('survives disk rehydration and is included in validated cloud snapshots', async () => {
  expect(pay(6)).toBe(true);
  await reliableStorage.flush();
  const raw = (await AsyncStorage.getItem('schafkopfrechner-games'))!;
  expect(validGameSnapshot(JSON.parse(raw).state)).toBe(true);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
  useGameStore.setState({
    currentTable: null,
    activeGame: false,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
  });
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', raw);
  await useGameStore.persist.rehydrate();
  expect(due().map((b) => b.amount)).toEqual([4, -4, 0, 0]);
  const corrupt = JSON.parse(raw).state;
  corrupt.currentTable.interimPayments[0].toPlayerId = 'unknown';
  expect(validGameSnapshot(corrupt)).toBe(false);
});
it('retains the stock and refuses a full clear while stock is funded', () => {
  const settings = structuredClone(
    useGameStore.getState().currentTable!.settings,
  );
  settings.games.stock.enabled = true;
  settings.games.stock.value = 1;
  expect(useGameStore.getState().updateCurrentTableSettings(settings)).toBe(
    true,
  );
  expect(
    seedLegacyRound({
      gameType: 'stock',
      winnerId: '',
      winnerIds: [],
      loserIds: ['a', 'b', 'c', 'd'],
      amount: 4,
      stockAction: 'deposit',
      stockCompletesDeal: false,
    }),
  ).toBe(true);
  const s = useGameStore.getState();
  expect(s.settleInterimPayments(s.currentTable!.id, revision())).toBe(false);
  expect(pay(3)).toBe(true);
  expect(useGameStore.getState().rounds).toHaveLength(2);
  expect(useGameStore.getState().settlements).toEqual([]);
  expect(validGameSnapshot(useGameStore.getState())).toBe(true);
});
