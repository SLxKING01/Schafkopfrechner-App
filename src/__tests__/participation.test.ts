import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureGameState } from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import {
  validCloudSnapshot,
  validGameSnapshot,
} from '../storage/validateGameState';
import { useGameStore } from '../store/gameStore';
import type { CreateRoundPayload, Player } from '../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
} from '../utils/accounting';
import {
  activePlayers,
  getCurrentDealerId,
  participationRevision,
  roundPlayers,
} from '../utils/dealerOrder';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
const roster: Player[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
  id,
  name: id.toUpperCase(),
  isLocal: true,
}));
const blank = {
  currentTable: null,
  activeGame: false,
  players: [],
  rounds: [],
  balances: [],
  settlements: [],
  archivedGameDays: [],
  games: [],
};
const state = () => useGameStore.getState();
const ids = () =>
  roundPlayers(
    state().currentTable,
    state().players,
    state().rounds.length,
  ).map((p) => p.id);
const pause = (id: string, value = true) =>
  state().setPlayerPaused(state().currentTable!.id, id, value);
function result(): CreateRoundPayload {
  const p = ids();
  return {
    gameType: 'solo',
    winnerId: p[0],
    loserIds: p.slice(1),
    declarerId: p[0],
    amount: 3,
  };
}
beforeEach(async () => {
  await reliableStorage.flush();
  useGameStore.setState(blank);
  state().createTable('Fuenferrunde', roster);
  const settings = structuredClone(state().currentTable!.settings);
  settings.games.stock.enabled = true;
  settings.games.stock.value = 0.5;
  state().updateCurrentTableSettings(settings);
});
afterEach(async () => {
  await reliableStorage.retryWrites();
  await reliableStorage.flush();
});
it('rotates all five active dealers and charges only the four actual participants', () => {
  for (const dealer of ['a', 'b', 'c', 'd', 'e']) {
    expect(state().currentTable?.dealerId).toBe(dealer);
    expect(ids()).not.toContain(dealer);
    const old = state().balances.find((b) => b.playerId === dealer)!.amount;
    expect(state().addRound(result())).toBe(true);
    expect(state().balances.find((b) => b.playerId === dealer)!.amount).toBe(
      old,
    );
    expect(state().rounds.at(-1)).toMatchObject({
      participantIds: roster.filter((p) => p.id !== dealer).map((p) => p.id),
      seatOrderIds: roster.map((p) => p.id),
      roundContext: { dealerIdBefore: dealer },
    });
  }
  expect(state().currentTable?.dealerId).toBe('a');
});
it('pauses the current dealer, skips it, and restores its original seat and balance', () => {
  expect(state().addRound(result())).toBe(true);
  const rounds = structuredClone(state().rounds);
  const balances = structuredClone(state().balances);
  expect(pause('b')).toBe(true);
  expect(state().currentTable?.dealerId).toBe('c');
  expect(ids()).toEqual(['a', 'c', 'd', 'e']);
  expect(state().setDealer(state().currentTable!.id, 'b')).toBe(false);
  expect(state().addRound(result())).toBe(true);
  expect(state().currentTable?.dealerId).toBe('d');
  expect(pause('b', false)).toBe(true);
  expect(state().players.map((p) => p.id)).toEqual(roster.map((p) => p.id));
  expect(state().rounds[0]).toEqual(rounds[0]);
  expect(state().balances.find((b) => b.playerId === 'b')).toEqual(
    balances.find((b) => b.playerId === 'b'),
  );
});
it('blocks new normal games below four but retains all balances for joint settlement', () => {
  state().addRound(result());
  const before = structuredClone(state().balances);
  pause('a');
  pause('b');
  expect(ids()).toEqual([]);
  expect(
    state().addRound({
      gameType: 'solo',
      winnerId: 'c',
      loserIds: ['d', 'e'],
      amount: 3,
    }),
  ).toBe(false);
  expect(state().balances).toEqual(before);
  expect(state().finishGameDay()).toBe(true);
  expect(state().archivedGameDays[0].players).toHaveLength(5);
  expect(state().archivedGameDays[0].balances).toEqual(before);
});
it('allows four active players including their dealer', () => {
  pause('e');
  expect(ids()).toEqual(['a', 'b', 'c', 'd']);
  expect(state().addRound(result())).toBe(true);
  expect(state().balances.find((b) => b.playerId === 'a')?.amount).toBe(3);
});
it('blocks a sixth active player or reactivation and gives a genuinely new player a zero balance', () => {
  expect(state().addPlayer('Fred')).toBe(false);
  pause('e');
  expect(state().addPlayer('Fred')).toBe(true);
  const fred = state().players.find((p) => p.name === 'Fred')!;
  expect(state().balances.find((b) => b.playerId === fred.id)?.amount).toBe(0);
  expect(pause('e', false)).toBe(false);
  expect(activePlayers(state().players)).toHaveLength(5);
});
it('rejects stale roster, dealer and seat snapshots even if the same four still play', () => {
  const payload = {
    ...result(),
    participationRevision: participationRevision(
      state().currentTable,
      state().players,
      state().rounds.length,
    ),
  };
  state().setPlayerOrder(['a', 'c', 'b', 'd', 'e']);
  expect(state().addRound(payload)).toBe(false);
  expect(state().rounds).toHaveLength(0);
});
it('rejects the sitting-out or paused player in a role and in knocking', () => {
  state().togglePlayerLeger('a');
  expect(state().currentTable?.placedLegerPlayerIds ?? []).toEqual([]);
  expect(state().addRound({ ...result(), declarerId: 'a' })).toBe(false);
  expect(state().addRound({ ...result(), loserIds: ['a', 'c', 'd'] })).toBe(
    false,
  );
  state().togglePlayerLeger('b');
  expect(state().currentTable?.placedLegerPlayerIds).toEqual(['b']);
  state().setDealer(state().currentTable!.id, 'b');
  expect(state().currentTable?.placedLegerPlayerIds).toEqual([]);
});
it('keeps the same dealer and Leger on Alle weiter and debits only the four participants', () => {
  state().togglePlayerLeger('b');
  expect(
    state().addRound({
      gameType: 'stock',
      winnerId: '',
      winnerIds: [],
      loserIds: ids(),
      amount: 2,
      stockAction: 'deposit',
      stockCompletesDeal: true,
    }),
  ).toBe(true);
  expect(state().currentTable).toMatchObject({
    dealerId: 'a',
    placedLegerPlayerIds: ['b'],
  });
  expect(state().balances).toEqual(
    roster.map((p) => ({ playerId: p.id, amount: p.id === 'a' ? 0 : -0.5 })),
  );
  expect(getStockBalanceCents(state().rounds)).toBe(200);
  expect(state().rounds[0].participantIds).toEqual(['b', 'c', 'd', 'e']);
});
it('distributes remaining stock to the active players including the sitting-out dealer, with deterministic cents', () => {
  state().addRound({
    gameType: 'stock',
    winnerId: '',
    winnerIds: [],
    loserIds: ids(),
    amount: 2,
    stockAction: 'deposit',
  });
  pause('b');
  pause('c');
  expect(state().finishGameDay('refund')).toBe(true);
  const closing = state().rounds.at(-1)!;
  expect(closing.loserIds).toEqual(['a', 'd', 'e']);
  expect(state().balances).toEqual([
    { playerId: 'a', amount: 0.67 },
    { playerId: 'b', amount: -0.5 },
    { playerId: 'c', amount: -0.5 },
    { playerId: 'd', amount: 0.17 },
    { playerId: 'e', amount: 0.16 },
  ]);
  expect(getStockBalanceCents(state().rounds)).toBe(0);
  expect(validGameSnapshot(state())).toBe(true);
});
it('blocks a funded stock closure with no active recipients', () => {
  state().addRound({
    gameType: 'stock',
    winnerId: '',
    winnerIds: [],
    loserIds: ids(),
    amount: 2,
    stockAction: 'deposit',
  });
  roster.forEach((p) => pause(p.id));
  expect(state().finishGameDay('refund')).toBe(false);
  expect(getStockBalanceCents(state().rounds)).toBe(200);
});
it('corrects historic parties within their original four, independent of the present active players', () => {
  state().addRound(result());
  const original = structuredClone(state().rounds[0]);
  pause('b');
  expect(state().updateRound(original.id, { ...original, amount: 6 })).toBe(
    true,
  );
  expect(state().rounds[0].participantIds).toEqual(original.participantIds);
  expect(state().currentTable?.dealerId).toBe('c');
  expect(
    state().updateRound(original.id, {
      ...original,
      winnerId: 'a',
      declarerId: 'a',
    }),
  ).toBe(false);
});
it('undoes without selecting a now-paused historic dealer and preserves historical participants', () => {
  state().addRound(result());
  pause('a');
  expect(state().undoLastRound()).toBe(true);
  expect(getCurrentDealerId(state().currentTable, state().players, 0)).toBe(
    'b',
  );
});
it('does not rotate on individual adjustment entries', () => {
  const before = structuredClone(state().currentTable);
  expect(
    state().addRound({
      gameType: 'custom',
      winnerId: '',
      winnerIds: [],
      loserIds: [],
      amount: 1,
      customAmounts: [
        { playerId: 'a', amount: 1 },
        { playerId: 'b', amount: -1 },
      ],
    }),
  ).toBe(true);
  expect(state().currentTable).toEqual({
    ...before,
    roundHistory: expect.any(Array),
  });
  expect(state().currentTable!.roundHistory!.at(-1)!.action).toBe('created');
});
it('retains statuses, dealer and historic seats after restart and in the cloud snapshot contract', async () => {
  state().addRound(result());
  pause('b');
  await reliableStorage.flush();
  const saved = (await AsyncStorage.getItem('schafkopfrechner-games'))!;
  const expected = {
    players: structuredClone(state().players),
    rounds: structuredClone(state().rounds),
    currentTable: structuredClone(state().currentTable),
  };
  expect(validCloudSnapshot(captureGameState())).toBe(true);
  useGameStore.setState(blank);
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', saved);
  await useGameStore.persist.rehydrate();
  expect(state()).toMatchObject(expected);
  expect(calculateRoundBalances(state().players, state().rounds, 'id')).toEqual(
    state().balances,
  );
});

it('removes a pending contribution when adding the fifth player makes its dealer sit out', () => {
  pause('e');
  state().removePlayer('e');
  state().togglePlayerLeger('a');
  expect(state().currentTable?.placedLegerPlayerIds).toEqual(['a']);
  expect(state().addPlayer('Fred')).toBe(true);
  expect(state().currentTable?.placedLegerPlayerIds).toEqual([]);
  expect(ids()).not.toContain('a');
});
it('advances to the next seat when removing an unused current dealer before the first game', () => {
  expect(state().setDealer(state().currentTable!.id, 'c')).toBe(true);
  state().removePlayer('c');
  expect(state().currentTable?.dealerId).toBe('d');
});
