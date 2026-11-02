import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureGameState } from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import {
  validCloudSnapshot,
  validGameSnapshot,
} from '../storage/validateGameState';
import { useGameStore } from '../store/gameStore';
import type { CreateRoundPayload, PlayerBalance } from '../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
  isPlayedRound,
  isValidRound,
} from '../utils/accounting';
import { summarizeCustomRound } from '../utils/customRound';
import { buildGameOverview } from '../utils/gameOverview';
import { paymentRevision } from '../utils/interimPayments';
import { emptyTariffOptions } from '../utils/roundTariff';
import { createStatisticsTable } from '../utils/statistics';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id.toUpperCase(),
  isLocal: true,
}));
const distribution = [5, -3, -2, 0].map((amount, i) => ({
  playerId: players[i].id,
  amount,
}));
const payload = (
  customAmounts: PlayerBalance[] = distribution,
): CreateRoundPayload => ({
  gameType: 'custom',
  winnerId: '',
  winnerIds: [],
  loserIds: [],
  amount: 5,
  customAmounts,
});
beforeEach(async () => {
  await reliableStorage.flush();
  useGameStore.setState({
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
    archivedGameDays: [],
    games: [],
  });
  useGameStore.getState().createTable('Eigene Buchung', players);
});
afterEach(async () => {
  await reliableStorage.retryWrites();
  await reliableStorage.flush();
});
it('books exact individual amounts and preserves dealer, stock, tariffs and knocking', () => {
  const s = useGameStore.getState();
  s.togglePlayerLeger('b');
  s.setTurboRamsch(true);
  const before = useGameStore.getState().currentTable;
  expect(s.addRound(payload())).toBe(true);
  const after = useGameStore.getState();
  expect(after.balances).toEqual(distribution);
  expect(after.currentTable).toEqual({
    ...before,
    roundHistory: expect.any(Array),
  });
  expect(after.currentTable!.roundHistory!.at(-1)!.action).toBe('created');
  expect(after.rounds[0]).toMatchObject({
    winnerId: '',
    winnerIds: [],
    loserIds: [],
    gameType: 'custom',
    customAmounts: distribution,
    roundContext: { completesDeal: false },
  });
  expect(after.rounds[0].declarerId).toBeUndefined();
  expect(after.rounds[0].tariffOptions).toBeUndefined();
  expect(isPlayedRound(after.rounds[0])).toBe(false);
  expect(after.settlements.map((p) => p.amount)).toEqual([3, 2]);
});
it('edits the same entry with exact cents, undoes it and retains actual intermediate payments', () => {
  expect(useGameStore.getState().addRound(payload())).toBe(true);
  const s = useGameStore.getState();
  const original = s.rounds[0];
  expect(
    s.recordInterimPayment(
      s.currentTable!.id,
      paymentRevision(s.currentTable!, s.balances),
      { id: 'custom-payment', fromPlayerId: 'b', toPlayerId: 'a', amount: 1 },
    ),
  ).toBe(true);
  const payments = structuredClone(
    useGameStore.getState().currentTable!.interimPayments,
  );
  const changed = [5, -2.99, -2.01, 0].map((amount, i) => ({
    playerId: players[i].id,
    amount,
  }));
  expect(s.updateRound(original.id, payload(changed))).toBe(true);
  expect(useGameStore.getState().rounds).toHaveLength(1);
  expect(useGameStore.getState().balances).toEqual(changed);
  expect(useGameStore.getState().rounds[0].id).toBe(original.id);
  s.togglePlayerLeger('c');
  const table = useGameStore.getState().currentTable;
  expect(s.undoLastRound()).toBe(true);
  expect(useGameStore.getState().currentTable).toEqual({
    ...table,
    roundHistory: expect.any(Array),
  });
  expect(
    useGameStore.getState().currentTable!.roundHistory!.at(-1)!.action,
  ).toBe('deleted');
  expect(useGameStore.getState().balances.every((b) => b.amount === 0)).toBe(
    true,
  );
  expect(useGameStore.getState().currentTable!.interimPayments).toEqual(
    payments,
  );
  expect(useGameStore.getState().settlements).toEqual([
    expect.objectContaining({ fromPlayerId: 'a', toPlayerId: 'b', amount: 1 }),
  ]);
});
it.each([
  [5, -3, -1, 0],
  [5, -3, -2.001, 0],
  [5, -3, NaN, 0],
  [5, -3, Infinity, 0],
  [0, 0, 0, 0],
])('rejects invalid or nonzero-sum distributions %j', (...values) => {
  const p = payload(
    values.map((amount, i) => ({ playerId: players[i].id, amount })),
  );
  expect(isValidRound(p, players)).toBe(false);
  expect(useGameStore.getState().addRound(p)).toBe(false);
  expect(useGameStore.getState().rounds).toEqual([]);
});
it('rejects unknown or duplicate players, mismatched transfer volume and hidden multipliers', () => {
  for (const p of [
    payload([
      { playerId: 'unknown', amount: 5 },
      { playerId: 'b', amount: -5 },
    ]),
    payload([
      { playerId: 'a', amount: 5 },
      { playerId: 'a', amount: -5 },
    ]),
    { ...payload(), amount: 6 },
    { ...payload(), tariffOptions: { ...emptyTariffOptions } },
    { ...payload(), declarerId: 'a' },
    { ...payload(), suit: 'herz' as const },
  ])
    expect(useGameStore.getState().addRound(p)).toBe(false);
});
it('preserves stock and handles its eventual return alongside custom amounts', () => {
  const s = useGameStore.getState();
  const settings = structuredClone(s.currentTable!.settings);
  settings.games.stock.enabled = true;
  settings.games.stock.value = 0.5;
  s.updateCurrentTableSettings(settings);
  expect(
    s.addRound({
      gameType: 'stock',
      winnerId: '',
      winnerIds: [],
      loserIds: players.map((p) => p.id),
      amount: 2,
      stockAction: 'deposit',
    }),
  ).toBe(true);
  expect(s.addRound(payload())).toBe(true);
  expect(getStockBalanceCents(useGameStore.getState().rounds)).toBe(200);
  expect(s.finishGameDay('refund')).toBe(true);
  expect(useGameStore.getState().archivedGameDays[0].balances).toEqual(
    distribution,
  );
});
it('keeps bookkeeping out of counts, wins and statistics while final settlement uses it', () => {
  const s = useGameStore.getState();
  expect(
    s.addRound({
      gameType: 'solo',
      winnerId: 'a',
      loserIds: ['b', 'c', 'd'],
      amount: 1.5,
      declarerId: 'a',
    }),
  ).toBe(true);
  expect(s.addRound(payload())).toBe(true);
  const current = useGameStore.getState();
  const statistics = createStatisticsTable(
    'table:test',
    'Test',
    players,
    current.rounds,
    { kind: 'active' },
    'id',
  );
  expect(statistics.rounds).toHaveLength(1);
  expect(statistics.rounds[0].deltas.a).toBe(150);
  expect(current.balances.map((b) => b.amount)).toEqual([
    6.5, -3.5, -2.5, -0.5,
  ]);
  const overview = buildGameOverview({
    ...current,
    savedPlayers: [],
    matchDays: [],
    activeMatchDayId: null,
  });
  expect(overview.rounds).toHaveLength(1);
  expect(s.finishGameDay()).toBe(true);
  expect(useGameStore.getState().archivedGameDays[0].rounds).toHaveLength(2);
  expect(validGameSnapshot(useGameStore.getState())).toBe(true);
});
it('preserves distributions through disk rehydration, cloud snapshot validation and archive', async () => {
  expect(useGameStore.getState().addRound(payload())).toBe(true);
  await reliableStorage.flush();
  const raw = (await AsyncStorage.getItem('schafkopfrechner-games'))!;
  expect(validGameSnapshot(JSON.parse(raw).state)).toBe(true);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
  useGameStore.setState({
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
  });
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', raw);
  await useGameStore.persist.rehydrate();
  expect(useGameStore.getState().rounds[0].customAmounts).toEqual(distribution);
  expect(useGameStore.getState().finishGameDay()).toBe(true);
  expect(
    useGameStore.getState().archivedGameDays[0].rounds[0].customAmounts,
  ).toEqual(distribution);
});
it('protects player references and leaves new players uncharged for historical bookkeeping', () => {
  const s = useGameStore.getState();
  s.addRound(payload());
  s.removePlayer('b');
  expect(useGameStore.getState().players).toHaveLength(4);
  expect(s.addPlayer('E')).toBe(true);
  expect(useGameStore.getState().balances.at(-1)!.amount).toBe(0);
  expect(calculateRoundBalances(players, [payload()], 'id')).toEqual(
    distribution,
  );
});
it.each(['', '1,', '-1', 'abc', '1,234', 'Infinity'])(
  'does not accept incomplete or invalid currency input %s',
  (amount) => {
    const result = summarizeCustomRound(players, {
      a: { amount, negative: false },
    });
    expect(result.totalCents).toBeNull();
    expect(result.error).toBeTruthy();
  },
);
