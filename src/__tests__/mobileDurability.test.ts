import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  GAME_STORE_KEY,
  gameStorageAdapter,
  useStorageStatus,
} from '../storage/durableGameStorage';
import { reliableStorage } from '../storage/reliableStorage';
import { validateStoredValue } from '../storage/validateGameState';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { calculateBalances } from '../utils/calculateBalances';
import { calculatePlayerStats } from '../utils/calculatePlayerStats';
import { historicalNames } from '../utils/historicalNames';
import { validParties } from '../utils/winningParty';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  isLocal: true,
}));
const party = {
  winnerId: 'a',
  winnerIds: ['a', 'b'],
  loserIds: ['c', 'd'],
  amount: 10.01,
  gameType: 'rufspiel' as const,
};

beforeEach(async () => {
  useStorageStatus.setState({ error: null, busy: false });
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
  usePlayerStore.setState({ players });
  await useGameStore.getState().persistGame();
});

it('keeps an open table and its rounds when switching is refused', async () => {
  expect(await useGameStore.getState().createTable('Old', players)).toBe(true);
  useGameStore.getState().addRound(party);
  await useGameStore.getState().persistGame();
  const old = useGameStore.getState();
  useGameStore.getState().resetGame();
  expect(await useGameStore.getState().createTable('New', players)).toBe(false);
  expect(useGameStore.getState().currentTable).toEqual(old.currentTable);
  expect(useGameStore.getState().rounds).toEqual(old.rounds);
  expect(useGameStore.getState().archivedGameDays).toEqual([]);
});

it('archives a completed table once and persists the replacement table', async () => {
  await useGameStore.getState().createTable('Old', players);
  useGameStore.getState().addRound(party);
  expect(useGameStore.getState().finishGameDay()).toBe(true);
  expect(useGameStore.getState().createTable('Next', players)).toBe(true);
  await reliableStorage.flush();
  const disk = JSON.parse(
    (await AsyncStorage.getItem('schafkopfrechner-games'))!,
  );
  expect(disk.state.archivedGameDays).toHaveLength(1);
  expect(disk.state.archivedGameDays[0].rounds).toHaveLength(1);
  expect(disk.state.currentTable.name).toBe('Next');
});

it('does not let the obsolete secondary backup replace newer archives on reload', async () => {
  await useGameStore.getState().createTable('New', players);
  await useGameStore.getState().persistGame();
  await AsyncStorage.setItem(
    'schafkopfrechner:mvp-game-state',
    JSON.stringify({
      currentTable: { id: 'stale', name: 'Stale' },
      players: [],
      rounds: [],
      settlements: [],
      balances: [],
      activeGame: false,
      archivedTables: [],
    }),
  );
  await useGameStore.getState().hydrateGame();
  expect(useGameStore.getState().currentTable?.name).toBe('New');
});

it('rejects a snapshot with missing participants rather than inventing their data', async () => {
  await useGameStore.getState().createTable('Damaged', players);
  useGameStore.getState().addRound(party);
  const state = useGameStore.getState();
  expect(
    validateStoredValue('schafkopfrechner-games', {
      state: {
        ...state,
        players: state.players.filter((player) => player.id !== 'a'),
        balances: state.balances.filter((balance) => balance.playerId !== 'a'),
        settlements: [],
      },
      version: 0,
    }),
  ).toBe(false);
});

it('preserves both winning players and exact cents on edit, stats and archive payment changes', async () => {
  await useGameStore.getState().createTable('Party', players);
  useGameStore.getState().addRound(party);
  const id = useGameStore.getState().rounds[0].id;
  expect(
    useGameStore.getState().updateRound(id, { ...party, amount: 20.01 }),
  ).toBe(true);
  expect(useGameStore.getState().rounds).toHaveLength(1);
  expect(useGameStore.getState().balances.map((entry) => entry.amount)).toEqual(
    [10.01, 10, -10.01, -10],
  );
  const stats = calculatePlayerStats(players, [
    { ...party, id: 'g', createdAt: 'now', gameTypeId: 'sauspiel' },
  ]);
  expect(stats.map((entry) => entry.wins)).toEqual([1, 1, 0, 0]);
  useGameStore.getState().finishGameDay();
  const oldTable = useGameStore.getState().currentTable!.id;
  await useGameStore.getState().createTable('Next', players);
  const current = useGameStore.getState();
  const payment = current.archivedGameDays[0].settlements[0].id;
  useGameStore.getState().markSettlementPaid(payment, true, oldTable);
  expect(
    useGameStore.getState().archivedGameDays[0].settlements[0].isPaid,
  ).toBe(true);
  expect(useGameStore.getState().balances).toEqual(current.balances);
  expect(useGameStore.getState().settlements).toEqual(current.settlements);
});

it('accepts unchanged legacy parties only on edits, without guessing a second winner', () => {
  const old = {
    id: 'legacy',
    winnerId: 'a',
    loserIds: ['b', 'c', 'd'],
    amount: 10.01,
    gameTypeId: 'sauspiel',
    createdAt: 'old',
  };
  expect(validParties(old, players, 'sauspiel')).toBe(false);
  expect(validParties(old, players, 'sauspiel', old)).toBe(true);
  expect(
    validParties({ ...old, loserIds: ['c', 'd'] }, players, 'sauspiel', old),
  ).toBe(false);
  useGameStore.setState({ games: [old] });
  expect(useGameStore.getState().updateGame({ ...old })).toBe(true);
  expect(useGameStore.getState().games[0]).not.toHaveProperty('winnerIds');
  expect(
    calculateBalances(players, [old]).map((entry) => entry.amount),
  ).toEqual([10.01, -3.34, -3.34, -3.33]);
});

it('keeps saved names if the separate player directory is damaged', () => {
  expect(
    useGameStore.getState().addGame({
      ...party,
      gameTypeId: 'sauspiel',
      options: { laufende: 0, schneider: false, schwarz: false },
    }),
  ).toBe(true);
  const games = useGameStore.getState().games;
  expect(historicalNames([], games).get('a')).toBe('a');
  expect(historicalNames([], games).get('b')).toBe('b');
  expect(
    calculateBalances([], games).reduce(
      (sum, balance) => sum + Math.round(balance.amount * 100),
      0,
    ),
  ).toBe(0);
});

it('rejects an unreadable save without overwriting its bytes', async () => {
  const damaged = '{invalid JSON';
  await AsyncStorage.setItem(GAME_STORE_KEY, damaged);
  await expect(gameStorageAdapter.getItem(GAME_STORE_KEY)).rejects.toThrow(
    'Invalid stored game state',
  );
  expect(await AsyncStorage.getItem(GAME_STORE_KEY)).toBe(damaged);
  expect(useStorageStatus.getState().error).toContain('nicht lesbar');
});

it.each([
  { ...party, winnerIds: ['a', 'a'] },
  { ...party, winnerIds: [] },
  { ...party, winnerIds: ['a', 'missing'] },
  { ...party, loserIds: ['b', 'c'] },
  { ...party, loserIds: ['c', 'c'] },
])('rejects invalid winning or losing participants %#', (invalid) => {
  expect(validParties(invalid, players, 'rufspiel')).toBe(false);
});
