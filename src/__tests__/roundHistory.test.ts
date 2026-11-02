import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultTableSettings } from '../constants/tableSettings';
import { captureGameState } from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import {
  validateStoredValue,
  validCloudSnapshot,
} from '../storage/validateGameState';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import type { AuthUser } from '../types/auth';
import { paymentRevision } from '../utils/interimPayments';
import { roundHistoryDiff } from '../utils/roundHistory';
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
const payload = {
  gameType: 'wenz' as const,
  winnerId: 'a',
  winnerIds: ['a'],
  loserIds: ['b', 'c', 'd'],
  declarerId: 'a',
  amount: 1.5,
  tariffOptions: { ...emptyTariffOptions },
};

beforeEach(async () => {
  await reliableStorage.flush();
  useAuthStore.setState({ user: null, session: null, isAuthenticated: false });
  usePlayerStore.setState({ players: [] });
  useMatchDayStore.setState({ matchDays: [], activeMatchDayId: null });
  useGameStore.setState({
    games: [],
    archivedGameDays: [],
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
  });
  const settings = createDefaultTableSettings();
  settings.games.wenz.enabled = true;
  expect(
    useGameStore.getState().createTable('Protokolltest', players, settings),
  ).toBe(true);
});
afterEach(async () => {
  await reliableStorage.flush();
});

it('records successful creation and correction with immutable snapshots, honest author and changed fields only', () => {
  const store = useGameStore.getState();
  expect(store.addRound(payload)).toBe(true);
  const id = useGameStore.getState().rounds[0].id;
  const first = structuredClone(
    useGameStore.getState().currentTable!.roundHistory![0],
  );
  expect(first).toMatchObject({
    roundId: id,
    sequence: 1,
    action: 'created',
    actor: { kind: 'local', name: 'Lokale Erfassung' },
    after: { amount: 1.5 },
  });
  useAuthStore.setState({
    user: {
      id: 'account',
      user_metadata: { username: 'Simon' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-01T18:00:00.000Z',
    } as AuthUser,
  });
  expect(
    store.updateRound(id, {
      ...payload,
      amount: 2.4,
      tariffOptions: { ...emptyTariffOptions, laufende: 3 },
    }),
  ).toBe(true);
  const events = useGameStore.getState().currentTable!.roundHistory!;
  expect(events).toHaveLength(2);
  expect(events[0]).toEqual(first);
  expect(events[1]).toMatchObject({
    roundId: id,
    sequence: 2,
    action: 'updated',
    actor: { kind: 'account', id: 'account', name: 'Simon' },
    before: { amount: 1.5 },
    after: { amount: 2.4 },
  });
  expect(roundHistoryDiff(events[1])).toEqual(
    expect.arrayContaining([
      { label: 'Laufende', before: '0', after: '3' },
      { label: 'Tarif je Spieler', before: '0,50 €', after: '0,80 €' },
    ]),
  );
  expect(roundHistoryDiff(events[1]).map((d) => d.label)).not.toEqual(
    expect.arrayContaining(['Ansager', 'Spielart', 'id', 'updatedAt']),
  );
  expect(
    useGameStore.getState().balances.find((b) => b.playerId === 'a')!.amount,
  ).toBe(2.4);
});

it('does not log rejected changes or no-op saves and does not attribute guest actions to a player', () => {
  const store = useGameStore.getState();
  store.addRound(payload);
  const id = useGameStore.getState().rounds[0].id;
  expect(store.updateRound(id, { ...payload, amount: 100 })).toBe(false);
  expect(store.updateRound(id, payload)).toBe(true);
  expect(useGameStore.getState().currentTable!.roundHistory).toHaveLength(1);
  expect(store.addRound({ ...payload, amount: -1 })).toBe(false);
  expect(useGameStore.getState().currentTable!.roundHistory).toHaveLength(1);
});

it('retains removed rounds in the audit trail without retaining their balance impact', () => {
  const store = useGameStore.getState();
  store.addRound(payload);
  const id = useGameStore.getState().rounds[0].id;
  expect(store.undoLastRound()).toBe(true);
  const state = useGameStore.getState();
  expect(state.rounds).toEqual([]);
  expect(state.balances.every((b) => b.amount === 0)).toBe(true);
  expect(state.currentTable!.roundHistory!.at(-1)).toMatchObject({
    action: 'deleted',
    roundId: id,
    before: { amount: 1.5 },
  });
  expect(state.currentTable!.roundHistory!.at(-1)!.after).toBeUndefined();
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it('records dependent stock recalculation against its source correction', () => {
  const store = useGameStore.getState();
  const settings = structuredClone(store.currentTable!.settings);
  settings.games.stock.enabled = true;
  expect(store.updateCurrentTableSettings(settings)).toBe(true);
  expect(
    store.addRound({
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
  expect(store.addRound(calling)).toBe(true);
  expect(
    store.addRound({
      ...calling,
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
    }),
  ).toBe(true);
  const before = useGameStore.getState();
  const source = before.rounds[1].id;
  const dependent = before.rounds[2].id;
  const oldHistoryLength = before.currentTable!.roundHistory!.length;
  expect(
    store.updateRound(source, {
      ...calling,
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
    }),
  ).toBe(true);
  const events = useGameStore
    .getState()
    .currentTable!.roundHistory!.slice(oldHistoryLength);
  expect(events.find((e) => e.roundId === dependent)).toMatchObject({
    action: 'updated',
    causeRoundId: source,
    before: { stockBeforeCents: 160 },
    after: { stockBeforeCents: 0 },
  });
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it('survives disk rehydration, archive and repeated snapshot serialization with stable event IDs', async () => {
  const store = useGameStore.getState();
  store.addRound(payload);
  const roundId = useGameStore.getState().rounds[0].id;
  store.undoLastRound();
  expect(store.restoreRound(store.currentTable!.id, roundId)).toBe(true);
  const original = structuredClone(
    useGameStore.getState().currentTable!.roundHistory,
  );
  await reliableStorage.flush();
  const raw = JSON.parse(
    (await AsyncStorage.getItem('schafkopfrechner-games'))!,
  );
  expect(validateStoredValue('schafkopfrechner-games', raw)).toBe(true);
  expect(raw.state.currentTable.roundHistory).toEqual(original);
  useGameStore.setState({
    currentTable: null,
    rounds: [],
    players: [],
    balances: [],
    settlements: [],
    activeGame: false,
  });
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', JSON.stringify(raw));
  await useGameStore.persist.rehydrate();
  expect(useGameStore.getState().currentTable!.roundHistory).toEqual(original);
  expect(useGameStore.getState().finishGameDay()).toBe(true);
  expect(
    useGameStore.getState().archivedGameDays[0].table.roundHistory,
  ).toEqual(original);
  const cloud = captureGameState();
  expect(validCloudSnapshot(cloud)).toBe(true);
  expect(
    JSON.parse(JSON.stringify(cloud)).archivedGameDays[0].table.roundHistory,
  ).toEqual(original);
  expect(captureGameState().archivedGameDays![0].table.roundHistory).toEqual(
    original,
  );
});

it('accepts old games without fabricated creation events and starts at the first actual correction', () => {
  const store = useGameStore.getState();
  store.addRound(payload);
  const state = useGameStore.getState();
  useGameStore.setState({
    currentTable: { ...state.currentTable!, roundHistory: undefined },
  });
  expect(
    store.updateRound(state.rounds[0].id, {
      ...payload,
      amount: 2.4,
      tariffOptions: { ...emptyTariffOptions, laufende: 3 },
    }),
  ).toBe(true);
  expect(
    useGameStore.getState().currentTable!.roundHistory!.map((e) => e.action),
  ).toEqual(['updated']);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it('rejects malformed, duplicate or inconsistent history while accepting reordered JSON object keys', () => {
  useGameStore.getState().addRound(payload);
  const cloud = captureGameState();
  expect(validCloudSnapshot(cloud)).toBe(true);
  const duplicate = structuredClone(cloud);
  duplicate.currentTable!.roundHistory!.push(
    duplicate.currentTable!.roundHistory![0],
  );
  expect(validCloudSnapshot(duplicate)).toBe(false);
  const damaged = structuredClone(cloud);
  damaged.currentTable!.roundHistory![0].after!.amount = 99;
  expect(validCloudSnapshot(damaged)).toBe(false);
  const actor = structuredClone(cloud);
  actor.currentTable!.roundHistory![0].actor = {
    kind: 'account',
    id: '',
    name: 'Fake',
  };
  expect(validCloudSnapshot(actor)).toBe(false);
  const shuffled = JSON.parse(
    JSON.stringify(cloud, (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).reverse())
        : value,
    ),
  );
  expect(validCloudSnapshot(shuffled)).toBe(true);
});

it('restores the latest corrected snapshot once with the same identity, author and dealer, and retains history', () => {
  const store = useGameStore.getState();
  const tableId = store.currentTable!.id;
  store.addRound(payload);
  const id = useGameStore.getState().rounds[0].id;
  store.updateRound(id, {
    ...payload,
    amount: 2.4,
    tariffOptions: { ...emptyTariffOptions, laufende: 3 },
  });
  const before = structuredClone(useGameStore.getState().rounds[0]);
  const dealer = useGameStore.getState().currentTable!.dealerId;
  store.undoLastRound();
  const history = structuredClone(
    useGameStore.getState().currentTable!.roundHistory,
  );
  expect(store.restoreRound(tableId, id)).toBe(true);
  expect(useGameStore.getState().rounds).toEqual([before]);
  expect(useGameStore.getState().currentTable!.dealerId).toBe(dealer);
  expect(
    useGameStore.getState().currentTable!.roundHistory!.slice(0, -1),
  ).toEqual(history);
  expect(
    useGameStore.getState().currentTable!.roundHistory!.at(-1),
  ).toMatchObject({
    action: 'restored',
    roundId: id,
    actor: { kind: 'local', name: 'Lokale Erfassung' },
  });
  expect(store.restoreRound(tableId, id)).toBe(false);
  expect(useGameStore.getState().rounds).toHaveLength(1);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});

it.each([false, true])(
  'restores several removals in original order even after newer games, reverse=%s',
  (reverse) => {
    const store = useGameStore.getState();
    const tableId = store.currentTable!.id;
    for (let i = 0; i < 3; i++) store.addRound(payload);
    const original = useGameStore.getState().rounds.map((r) => r.id);
    store.undoLastRound();
    store.undoLastRound();
    store.addRound(payload);
    const newer = useGameStore.getState().rounds.at(-1)!.id;
    const dealer = useGameStore.getState().currentTable!.dealerId;
    const removed = original.slice(1);
    if (reverse) removed.reverse();
    for (const id of removed)
      expect(store.restoreRound(tableId, id)).toBe(true);
    expect(useGameStore.getState().rounds.map((r) => r.id)).toEqual([
      ...original,
      newer,
    ]);
    expect(useGameStore.getState().currentTable!.dealerId).toBe(dealer);
    expect(validCloudSnapshot(captureGameState())).toBe(true);
  },
);

it('preserves real interim payments when a custom booking is restored', () => {
  const store = useGameStore.getState();
  const tableId = store.currentTable!.id;
  expect(
    store.addRound({
      gameType: 'custom',
      winnerId: '',
      winnerIds: [],
      loserIds: [],
      amount: 5,
      customAmounts: [
        { playerId: 'a', amount: 5 },
        { playerId: 'b', amount: -5 },
        { playerId: 'c', amount: 0 },
        { playerId: 'd', amount: 0 },
      ],
    }),
  ).toBe(true);
  const id = useGameStore.getState().rounds[0].id;
  const state = useGameStore.getState();
  expect(
    store.recordInterimPayment(
      tableId,
      paymentRevision(state.currentTable!, state.balances),
      { id: 'restored-payment', fromPlayerId: 'b', toPlayerId: 'a', amount: 2 },
    ),
  ).toBe(true);
  const paid = structuredClone(
    useGameStore.getState().currentTable!.interimPayments,
  );
  store.undoLastRound();
  expect(store.restoreRound(tableId, id)).toBe(true);
  expect(useGameStore.getState().currentTable!.interimPayments).toEqual(paid);
  expect(
    useGameStore.getState().balances.find((b) => b.playerId === 'a')!.amount,
  ).toBe(5);
});

it('rejects wrong tables, missing players and finished tables without changing financial state or history', () => {
  const store = useGameStore.getState();
  const tableId = store.currentTable!.id;
  store.addRound(payload);
  const id = useGameStore.getState().rounds[0].id;
  store.undoLastRound();
  expect(store.restoreRound('another-table', id)).toBe(false);
  store.removePlayer('a');
  const before = captureGameState();
  expect(store.restoreRound(tableId, id)).toBe(false);
  expect(captureGameState()).toEqual(before);
  useGameStore.setState({
    currentTable: { ...useGameStore.getState().currentTable!, isActive: false },
  });
  expect(store.restoreRound(tableId, id)).toBe(false);
});

it('replays dependent stock movements on restoration and rejects incompatible later rule changes atomically', () => {
  const store = useGameStore.getState();
  const tableId = store.currentTable!.id;
  const settings = structuredClone(store.currentTable!.settings);
  settings.games.stock.enabled = true;
  store.updateCurrentTableSettings(settings);
  expect(
    store.addRound({
      gameType: 'stock',
      winnerId: '',
      winnerIds: [],
      loserIds: players.map((p) => p.id),
      amount: 0.8,
      stockAction: 'deposit',
    }),
  ).toBe(true);
  const id = useGameStore.getState().rounds[0].id;
  store.undoLastRound();
  expect(
    store.addRound({
      gameType: 'rufspiel',
      declarerId: 'a',
      partnerId: 'b',
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
      amount: 0.4,
    }),
  ).toBe(true);
  expect(useGameStore.getState().rounds[0].stockBeforeCents).toBe(0);
  expect(store.restoreRound(tableId, id)).toBe(true);
  expect(useGameStore.getState().rounds[1]).toMatchObject({
    stockBeforeCents: 80,
    stockAfterCents: 0,
    stockAction: 'payout',
  });
  expect(
    useGameStore
      .getState()
      .currentTable!.roundHistory!.some(
        (event) => event.causeRoundId === id && event.action === 'updated',
      ),
  ).toBe(true);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
  store.undoLastRound();
  store.undoLastRound();
  const changed = structuredClone(settings);
  changed.games.stock.enabled = false;
  changed.games.ramsch.enabled = true;
  expect(store.updateCurrentTableSettings(changed)).toBe(true);
  const before = captureGameState();
  expect(store.restoreRound(tableId, id)).toBe(false);
  expect(captureGameState()).toEqual(before);
});

it('restores older undo records without position metadata ahead of later entries and rejects invented restoration events', () => {
  const store = useGameStore.getState();
  const tableId = store.currentTable!.id;
  store.addRound(payload);
  const id = useGameStore.getState().rounds[0].id;
  store.undoLastRound();
  const table = useGameStore.getState().currentTable!;
  useGameStore.setState({
    currentTable: {
      ...table,
      roundHistory: table.roundHistory!.map(
        ({ roundOrderIds: _order, ...event }) => event,
      ),
    },
  });
  store.addRound(payload);
  const later = useGameStore.getState().rounds[0].id;
  expect(store.restoreRound(tableId, id)).toBe(true);
  expect(useGameStore.getState().rounds.map((r) => r.id)).toEqual([id, later]);
  const snapshot = captureGameState();
  expect(validCloudSnapshot(snapshot)).toBe(true);
  snapshot.currentTable!.roundHistory![0].action = 'restored';
  expect(validCloudSnapshot(snapshot)).toBe(false);
});

it('reprices stock and games atomically, keeps real payments and audits every affected snapshot', () => {
  const store = useGameStore.getState();
  const settings = structuredClone(store.currentTable!.settings);
  settings.games.stock.enabled = true;
  store.updateCurrentTableSettings(settings);
  expect(
    store.addRound({
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
    tariffOptions: { ...emptyTariffOptions },
  };
  expect(store.addRound(calling)).toBe(true);
  expect(
    store.addRound({
      ...calling,
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
    }),
  ).toBe(true);
  const before = useGameStore.getState();
  expect(
    store.recordInterimPayment(
      before.currentTable!.id,
      paymentRevision(before.currentTable!, before.balances),
      { id: 'reprice-paid', fromPlayerId: 'c', toPlayerId: 'a', amount: 0.1 },
    ),
  ).toBe(true);
  const paid = structuredClone(
    useGameStore.getState().currentTable!.interimPayments,
  );
  const ids = before.rounds.map((r) => r.id);
  const oldHistory = structuredClone(before.currentTable!.roundHistory!);
  settings.games.stock.value = 0.3;
  settings.games.rufspiel.value = 0.5;
  expect(store.updateCurrentTableSettings(settings, 'all')).toBe(true);
  const state = useGameStore.getState();
  expect(state.rounds.map((r) => r.id)).toEqual(ids);
  expect(state.rounds.map((r) => r.stockAfterCents)).toEqual([120, 240, 0]);
  expect(state.balances.map((b) => b.amount)).toEqual([0.3, 0.3, -0.3, -0.3]);
  expect(state.currentTable!.interimPayments).toEqual(paid);
  expect(state.currentTable!.roundHistory!.slice(0, oldHistory.length)).toEqual(
    oldHistory,
  );
  expect(
    state
      .currentTable!.roundHistory!.slice(oldHistory.length)
      .map((e) => e.action),
  ).toEqual(['updated', 'updated', 'updated']);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
});
