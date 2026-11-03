import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureGameState } from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import { validCloudSnapshot } from '../storage/validateGameState';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { getStockBalanceCents } from '../utils/accounting';
import { paymentRevision } from '../utils/interimPayments';
import { roundHistoryFingerprint } from '../utils/roundHistory';
import { emptyTariffOptions } from '../utils/roundTariff';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id.toUpperCase(),
  isLocal: true,
}));
const entry = {
  gameType: 'wenz' as const,
  winnerId: 'a',
  winnerIds: ['a'],
  loserIds: ['b', 'c', 'd'],
  declarerId: 'a',
  amount: 1.5,
  tariffOptions: { ...emptyTariffOptions },
};
const state = () => useGameStore.getState();
const event = (roundId?: string) =>
  state()
    .currentTable!.roundHistory!.filter(
      (e) => !roundId || e.roundId === roundId,
    )
    .at(-1)!;
const undo = (id: string) =>
  state().revertRoundChange(state().currentTable!.id, id);

beforeEach(async () => {
  await reliableStorage.flush();
  useAuthStore.setState({ user: null, session: null, isAuthenticated: false });
  useGameStore.setState({
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
    activeGame: false,
  });
  state().createTable('Rückgängig', players);
  const settings = structuredClone(state().currentTable!.settings);
  settings.games.wenz.enabled = true;
  state().updateCurrentTableSettings(settings);
});

it('undoes a creation exactly once, restores the untouched dealer/Leger and records the inverse action', () => {
  state().togglePlayerLeger('a');
  expect(
    state().addRound({
      ...entry,
      amount: 3,
      tariffOptions: { ...emptyTariffOptions, legerCount: 1 },
    }),
  ).toBe(true);
  const created = event();
  const round = state().rounds[0];
  const tableId = state().currentTable!.id;
  expect(state().currentTable!.dealerId).toBe('b');
  expect(undo(created.id)).toBe(true);
  expect(state().rounds).toHaveLength(0);
  expect(state().currentTable).toMatchObject({
    dealerId: 'a',
    placedLegerPlayerIds: ['a'],
  });
  expect(event()).toMatchObject({
    action: 'deleted',
    roundId: round.id,
    undoOfEventId: created.id,
  });
  expect(undo(created.id)).toBe(false);
  expect(state().restoreRound(tableId, round.id, event().id)).toBe(true);
  expect(state().rounds).toEqual([round]);
  expect(state().currentTable!.dealerId).toBe('b');
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it('reverts a correction to the exact historical input and tariff without rewinding later settings', () => {
  state().addRound(entry);
  const original = structuredClone(state().rounds[0]);
  expect(
    state().updateRound(original.id, {
      ...entry,
      amount: 2.4,
      tariffOptions: { ...emptyTariffOptions, laufende: 3 },
    }),
  ).toBe(true);
  const corrected = event();
  const settings = structuredClone(state().currentTable!.settings);
  settings.games.wenz.value = 0.8;
  expect(state().updateCurrentTableSettings(settings, 'future')).toBe(true);
  expect(undo(corrected.id)).toBe(true);
  expect(roundHistoryFingerprint(state().rounds[0])).toBe(
    roundHistoryFingerprint(original),
  );
  expect(state().currentTable!.settings.games.wenz.value).toBe(0.8);
  expect(event()).toMatchObject({
    action: 'updated',
    undoOfEventId: corrected.id,
  });
  expect(undo(corrected.id)).toBe(false);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it('removes only the selected creation and preserves later rounds, current dealer and real payments', () => {
  expect(
    state().addRound({
      gameType: 'custom',
      winnerId: '',
      winnerIds: [],
      loserIds: [],
      amount: 5,
      customAmounts: players.map((p, i) => ({
        playerId: p.id,
        amount: i === 0 ? 5 : i === 1 ? -5 : 0,
      })),
    }),
  ).toBe(true);
  const created = event();
  const table = state().currentTable!;
  expect(
    state().recordInterimPayment(
      table.id,
      paymentRevision(table, state().balances),
      { id: 'paid', fromPlayerId: 'b', toPlayerId: 'a', amount: 2 },
    ),
  ).toBe(true);
  state().addRound(entry);
  const newer = structuredClone(state().rounds.at(-1)!);
  const dealer = state().currentTable!.dealerId;
  const payments = structuredClone(state().currentTable!.interimPayments);
  expect(undo(created.id)).toBe(true);
  expect(state().rounds).toEqual([newer]);
  expect(state().currentTable!.dealerId).toBe(dealer);
  expect(state().currentTable!.interimPayments).toEqual(payments);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it('preserves manual dealer, seat, pause, Leger and Turbo changes across deletion and restoration', () => {
  state().addRound(entry);
  const id = state().rounds[0].id;
  const tableId = state().currentTable!.id;
  state().setPlayerOrder(['d', 'c', 'b', 'a']);
  state().setDealer(tableId, 'd');
  state().togglePlayerLeger('c');
  state().setTurboRamsch(true);
  state().setPlayerPaused(tableId, 'a', true);
  const before = structuredClone(state().currentTable!);
  const roster = structuredClone(state().players);
  expect(state().undoLastRound()).toBe(true);
  expect(state().currentTable).toMatchObject({
    dealerId: before.dealerId,
    placedLegerPlayerIds: before.placedLegerPlayerIds,
    turboRamschEnabled: true,
  });
  expect(state().restoreRound(tableId, id, event().id)).toBe(true);
  expect(state().currentTable!.dealerId).toBe(before.dealerId);
  expect(state().players).toEqual(roster);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it('rejects stale confirmation and an already modified/restored target even with identical timestamps', () => {
  state().addRound(entry);
  const first = structuredClone(state().rounds[0]);
  const created = event();
  expect(
    state().updateRound(first.id, {
      ...entry,
      winnerId: 'b',
      winnerIds: ['b'],
      loserIds: ['a', 'c', 'd'],
      declarerId: 'b',
    }),
  ).toBe(true);
  const before = captureGameState();
  expect(undo(created.id)).toBe(false);
  expect(captureGameState()).toEqual(before);
  state().addRound(entry);
  const newer = captureGameState();
  expect(
    state().undoLastRound(first.id, created.id, roundHistoryFingerprint(first)),
  ).toBe(false);
  expect(captureGameState()).toEqual(newer);
  state().undoLastRound();
  const removed = event();
  const id = removed.roundId;
  state().restoreRound(state().currentTable!.id, id, removed.id);
  state().undoLastRound();
  expect(state().restoreRound(state().currentTable!.id, id, removed.id)).toBe(
    false,
  );
});

it('replays dependent Stock payout/doubling when a correction is undone, without replacing old audit events', () => {
  const settings = structuredClone(state().currentTable!.settings);
  settings.games.stock.enabled = true;
  state().updateCurrentTableSettings(settings);
  expect(
    state().addRound({
      gameType: 'stock',
      winnerId: '',
      winnerIds: [],
      loserIds: players.map((p) => p.id),
      amount: 0.8,
      stockAction: 'deposit',
    }),
  ).toBe(true);
  const calling = {
    gameType: 'rufspiel' as const,
    declarerId: 'a',
    partnerId: 'b',
    winnerId: 'c',
    winnerIds: ['c', 'd'],
    loserIds: ['a', 'b'],
    amount: 0.4,
  };
  expect(state().addRound(calling)).toBe(true);
  const id = state().rounds.at(-1)!.id;
  expect(
    state().addRound({
      ...calling,
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
    }),
  ).toBe(true);
  const original = structuredClone(state().rounds);
  expect(
    state().updateRound(id, {
      ...calling,
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
    }),
  ).toBe(true);
  const correction = event(id);
  const history = structuredClone(state().currentTable!.roundHistory!);
  expect(undo(correction.id)).toBe(true);
  expect(state().rounds.map(roundHistoryFingerprint)).toEqual(
    original.map(roundHistoryFingerprint),
  );
  expect(state().currentTable!.roundHistory!.slice(0, history.length)).toEqual(
    history,
  );
  expect(getStockBalanceCents(state().rounds)).toBe(0);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it('retains undo context after rehydration and blocks finished/read-only tables', async () => {
  state().addRound(entry);
  const created = event();
  const tableId = state().currentTable!.id;
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
  expect(undo(created.id)).toBe(true);
  state().restoreRound(tableId, created.roundId, event().id);
  const latest = event();
  useAuthStore.setState({ user: { id: 'reader' } as never });
  const table = state().currentTable!;
  useGameStore.setState({
    currentTable: {
      ...table,
      shared: {
        userId: 'reader',
        ownerId: 'owner',
        role: 'read',
        version: 1,
        baseline: '{}',
        updatedAt: new Date().toISOString(),
      },
    },
  });
  const readOnly = captureGameState();
  expect(undo(latest.id)).toBe(false);
  expect(captureGameState()).toEqual(readOnly);
  useGameStore.setState({
    currentTable: { ...state().currentTable!, shared: undefined },
  });
  useAuthStore.setState({ user: null });
  state().finishGameDay();
  const before = captureGameState();
  expect(undo(latest.id)).toBe(false);
  expect(captureGameState()).toEqual(before);
});

it('rejects an undo atomically if a later rule change would leave an incompatible funded stock', () => {
  const settings = structuredClone(state().currentTable!.settings);
  settings.games.stock.enabled = true;
  state().updateCurrentTableSettings(settings);
  expect(
    state().addRound({
      gameType: 'stock',
      winnerId: '',
      winnerIds: [],
      loserIds: players.map((p) => p.id),
      amount: 0.8,
      stockAction: 'deposit',
    }),
  ).toBe(true);
  expect(
    state().addRound({
      gameType: 'rufspiel',
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
      declarerId: 'a',
      partnerId: 'b',
      amount: 0.4,
    }),
  ).toBe(true);
  const payout = event();
  settings.games.stock.enabled = false;
  settings.games.ramsch.enabled = true;
  expect(state().updateCurrentTableSettings(settings)).toBe(true);
  const before = captureGameState();
  expect(undo(payout.id)).toBe(false);
  expect(state().roundError).toContain('Stock');
  expect(captureGameState()).toEqual(before);
});

it('deletes a selected earlier round and retains its audit event', () => {
  expect(state().addRound(entry)).toBe(true);
  expect(state().addRound(entry)).toBe(true);
  expect(state().addRound(entry)).toBe(true);
  const [first, middle, last] = state().rounds;
  expect(
    state().undoLastRound(
      middle.id,
      event(middle.id).id,
      roundHistoryFingerprint(middle),
      true,
    ),
  ).toBe(true);
  expect(state().rounds.map(({ id }) => id)).toEqual([first.id, last.id]);
  expect(event(middle.id).action).toBe('deleted');
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});
