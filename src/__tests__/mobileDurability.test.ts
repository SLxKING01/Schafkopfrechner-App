import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  GAME_STORE_KEY,
  gameStorageAdapter,
  useStorageStatus,
} from '../storage/durableGameStorage';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { calculateBalances } from '../utils/calculateBalances';
import { calculatePlayerStats } from '../utils/calculatePlayerStats';
import { historicalNames } from '../utils/historicalNames';
import { validParties } from '../utils/winningParty';

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
    archivedTables: [],
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

it('does not change the table or archive when the durable write fails', async () => {
  expect(await useGameStore.getState().createTable('Old', players)).toBe(true);
  useGameStore.getState().addRound(party);
  await useGameStore.getState().persistGame();
  const old = useGameStore.getState();
  const durable = await AsyncStorage.getItem(GAME_STORE_KEY);
  const implementation = (
    AsyncStorage.setItem as jest.Mock
  ).getMockImplementation();
  const write = jest
    .spyOn(AsyncStorage, 'setItem')
    .mockRejectedValue(new Error('Disk full'));
  expect(await useGameStore.getState().resetGame()).toBe(false);
  expect(await useGameStore.getState().createTable('New', players)).toBe(false);
  expect(useGameStore.getState().currentTable).toEqual(old.currentTable);
  expect(useGameStore.getState().rounds).toEqual(old.rounds);
  expect(useGameStore.getState().archivedTables).toEqual([]);
  expect(await AsyncStorage.getItem(GAME_STORE_KEY)).toBe(durable);
  expect(useStorageStatus.getState().error).toContain(
    'Speichern fehlgeschlagen',
  );
  write.mockImplementation(implementation!);
});

it('serializes a double switch and keeps a checkpoint reloadable before returning success', async () => {
  await useGameStore.getState().createTable('Old', players);
  useGameStore.getState().addRound(party);
  const [first, duplicate] = await Promise.all([
    useGameStore.getState().resetGame(),
    useGameStore.getState().resetGame(),
  ]);
  expect([first, duplicate]).toEqual([true, false]);
  const disk = JSON.parse((await AsyncStorage.getItem(GAME_STORE_KEY))!);
  expect(disk.state.archivedTables).toHaveLength(1);
  expect(disk.state.archivedTables[0].rounds).toHaveLength(1);
  expect(disk.state.currentTable).toBeNull();
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

it('repairs missing modern ledger references without inventing a historical name', async () => {
  await useGameStore.getState().createTable('Damaged', players);
  useGameStore.getState().addRound(party);
  const state = useGameStore.getState();
  useGameStore.setState({
    players: state.players.filter((player) => player.id !== 'a'),
    balances: state.balances.filter((balance) => balance.playerId !== 'a'),
    settlements: [],
  });
  await useGameStore.getState().persistGame();
  await useGameStore.getState().hydrateGame();
  const restored = useGameStore.getState();
  expect(restored.players.some((player) => player.id === 'a')).toBe(false);
  expect(
    restored.balances.find((balance) => balance.playerId === 'a')?.amount,
  ).toBe(5.01);
  expect(
    restored.balances.reduce(
      (sum, balance) => sum + Math.round(balance.amount * 100),
      0,
    ),
  ).toBe(0);
  expect(restored.settlements.length).toBeGreaterThan(0);
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
  const payment = current.archivedTables[0].settlements[0].id;
  useGameStore.getState().markSettlementPaid(payment, oldTable);
  expect(useGameStore.getState().archivedTables[0].settlements[0].isPaid).toBe(
    true,
  );
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
