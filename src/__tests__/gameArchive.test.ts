import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultTableSettings } from '../constants/tableSettings';
import { reliableStorage } from '../storage/reliableStorage';
import { useGameStore } from '../store/gameStore';
import type { Player } from '../types/game';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const makePlayers = (): Player[] => [
  { id: 'a', name: 'Anna', isLocal: true },
  { id: 'b', name: 'Berkay', isLocal: true },
  { id: 'c', name: 'Chris', isLocal: true },
];
const blank = {
  currentTable: null,
  archivedGameDays: [],
  players: [],
  rounds: [],
  balances: [],
  settlements: [],
  games: [],
  activeGame: false,
  cloudOwnerId: null,
  cloudVersion: null,
  cloudBaseline: null,
  hydrated: false,
  localStateRestored: false,
};

function finishEvening() {
  expect(
    useGameStore.getState().createTable('Alter Spielabend', makePlayers()),
  ).toBe(true);
  expect(
    useGameStore.getState().addRound({
      winnerId: 'a',
      loserIds: ['b'],
      amount: 10,
      gameType: 'rufspiel',
    }),
  ).toBe(true);
  expect(
    useGameStore.getState().addRound({
      winnerId: 'c',
      loserIds: ['b'],
      amount: 5,
      gameType: 'solo',
    }),
  ).toBe(true);
  expect(useGameStore.getState().finishGameDay()).toBe(true);
  const state = useGameStore.getState();
  expect(state.settlements).toHaveLength(2);
  state.markSettlementPaid(state.settlements[0].id);
  return useGameStore.getState().archivedGameDays[0];
}

beforeEach(async () => {
  await reliableStorage.flush();
  await AsyncStorage.clear();
  useGameStore.setState(blank);
});

it('retains complete history and mixed payment states after reset, a new table and cold hydration', async () => {
  const archived = finishEvening();
  expect(archived.settlements.map(({ isPaid }) => isPaid)).toEqual([
    true,
    false,
  ]);
  expect(archived.rounds).toHaveLength(2);
  useGameStore.getState().resetGame();
  expect(useGameStore.getState().archivedGameDays).toEqual([archived]);
  expect(
    useGameStore.getState().createTable(
      'Neuer Abend',
      makePlayers().map((player) => ({
        ...player,
        name: `Neu ${player.name}`,
      })),
    ),
  ).toBe(true);
  await useGameStore.getState().persistGame();
  await reliableStorage.flush();
  const saved = await AsyncStorage.getItem('schafkopfrechner-games');
  expect(saved).not.toBeNull();
  useGameStore.setState(blank);
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', saved!);
  await useGameStore.persist.rehydrate();
  const restored = useGameStore.getState();
  expect(restored.currentTable?.name).toBe('Neuer Abend');
  expect(restored.archivedGameDays).toEqual([archived]);
  expect(restored.archivedGameDays[0].players[0].name).toBe('Anna');
});

it('includes archived evenings in the separate local recovery snapshot', async () => {
  const archived = finishEvening();
  useGameStore.getState().createTable('Neuer Abend', makePlayers());
  await useGameStore.getState().persistGame();
  useGameStore.setState(blank);
  await useGameStore.getState().hydrateGame();
  expect(useGameStore.getState().archivedGameDays).toEqual([archived]);
  expect(useGameStore.getState().currentTable?.name).toBe('Neuer Abend');
});

it('records completion exactly once and preserves payment updates across direct replacement', () => {
  const archived = finishEvening();
  expect(useGameStore.getState().finishGameDay()).toBe(false);
  expect(
    useGameStore.getState().createTable('Direkter Nachfolger', makePlayers()),
  ).toBe(true);
  expect(useGameStore.getState().archivedGameDays).toEqual([archived]);
  expect(useGameStore.getState().archivedGameDays).toHaveLength(1);
});

it('edits archived payments by table id without changing the current evening', () => {
  const archived = finishEvening();
  useGameStore.getState().createTable('Neuer Abend', makePlayers());
  useGameStore.getState().addRound({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 2,
    gameType: 'rufspiel',
  });
  const current = useGameStore.getState();
  const unpaid = archived.settlements.find(({ isPaid }) => !isPaid)!;
  current.markSettlementPaid(unpaid.id, true, archived.table.id);
  const state = useGameStore.getState();
  expect(state.currentTable).toEqual(current.currentTable);
  expect(state.rounds).toEqual(current.rounds);
  expect(state.balances).toEqual(current.balances);
  expect(state.settlements).toEqual(current.settlements);
  expect(
    state.archivedGameDays[0].settlements.every(({ isPaid }) => isPaid),
  ).toBe(true);
  state.markSettlementPaid(unpaid.id, false, archived.table.id);
  expect(
    useGameStore
      .getState()
      .archivedGameDays[0].settlements.find(({ id }) => id === unpaid.id)
      ?.isPaid,
  ).toBe(false);
});

it('blocks resetting or replacing an active evening, including an empty one', () => {
  useGameStore.getState().createTable('Nicht fertig', makePlayers());
  const original = useGameStore.getState().currentTable;
  useGameStore.getState().resetGame();
  expect(useGameStore.getState().currentTable).toEqual(original);
  expect(
    useGameStore.getState().createTable('Überschreiben', makePlayers()),
  ).toBe(false);
  expect(useGameStore.getState().currentTable).toEqual(original);
});

it('protects a closed evening against recalculation that would reset paid payments', () => {
  const archived = finishEvening();
  const state = useGameStore.getState();
  expect(state.addPlayer('Neu')).toBe(false);
  state.removePlayer('c');
  expect(state.updateCurrentTableSettings(createDefaultTableSettings())).toBe(
    false,
  );
  expect(useGameStore.getState().archivedGameDays).toEqual([archived]);
  expect(useGameStore.getState().settlements).toEqual(archived.settlements);
  expect(useGameStore.getState().players).toEqual(archived.players);
});

it('migrates a legacy completed table without an archive field and retains paid payments', async () => {
  const archived = finishEvening();
  const legacy = { ...useGameStore.getState(), archivedGameDays: undefined };
  useGameStore.setState(blank);
  await reliableStorage.flush();
  await AsyncStorage.setItem(
    'schafkopfrechner-games',
    JSON.stringify({ state: legacy, version: 0 }),
  );
  await useGameStore.persist.rehydrate();
  const migrated = useGameStore.getState().archivedGameDays[0];
  expect(migrated.table.id).toBe(archived.table.id);
  expect(migrated.settlements).toEqual(archived.settlements);
  expect(migrated.rounds).toEqual(archived.rounds);
  expect(migrated.completedAt).toBeNull();
  useGameStore.getState().createTable('Nach Migration', makePlayers());
  expect(useGameStore.getState().archivedGameDays).toEqual([migrated]);
});

it('does not resurrect an old recovery table over a valid empty primary state', async () => {
  finishEvening();
  await useGameStore.getState().persistGame();
  useGameStore.getState().resetGame();
  await reliableStorage.flush();
  await useGameStore.persist.rehydrate();
  expect(useGameStore.getState().localStateRestored).toBe(true);
  await useGameStore.getState().hydrateGame();
  expect(useGameStore.getState().currentTable).toBeNull();
  expect(useGameStore.getState().archivedGameDays).toHaveLength(1);
});
it('preserves account ownership when falling back to the separate recovery snapshot', async () => {
  useGameStore.getState().createTable('Account Tisch', makePlayers());
  useGameStore.setState({
    cloudOwnerId: 'original-owner',
    cloudVersion: 7,
    cloudBaseline: 'previous',
  });
  await useGameStore.getState().persistGame();
  useGameStore.setState(blank);
  await useGameStore.getState().hydrateGame();
  expect(useGameStore.getState()).toMatchObject({
    cloudOwnerId: 'original-owner',
    cloudVersion: 7,
    cloudBaseline: 'previous',
  });
});

it('restores data fields without accepting persisted replacements for store actions', async () => {
  const archived = finishEvening();
  const stored = {
    ...useGameStore.getState(),
    createTable: 'corrupt-action',
    hydrated: true,
  };
  await reliableStorage.flush();
  await AsyncStorage.setItem(
    'schafkopfrechner-games',
    JSON.stringify({ state: stored, version: 0 }),
  );
  await useGameStore.persist.rehydrate();
  expect(typeof useGameStore.getState().createTable).toBe('function');
  expect(useGameStore.getState().archivedGameDays[0]).toEqual(archived);
});

it('retains pending Leger, Turbo and seat order across a cold restart and clears Leger only after a valid round', async () => {
  useGameStore.getState().createTable('Offline Neustart', makePlayers());
  const game = useGameStore.getState();
  game.togglePlayerLeger('a');
  game.togglePlayerLeger('b');
  game.setTurboRamsch(true);
  game.setPlayerOrder(['a', 'c', 'b']);
  await game.persistGame();
  await reliableStorage.flush();
  const saved = await AsyncStorage.getItem('schafkopfrechner-games');
  useGameStore.setState(blank);
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', saved!);
  await useGameStore.persist.rehydrate();
  const restored = useGameStore.getState();
  expect(restored.currentTable).toMatchObject({
    placedLegerPlayerIds: ['a', 'b'],
    turboRamschEnabled: true,
    dealerId: 'a',
  });
  expect(restored.players.map((p) => p.id)).toEqual(['a', 'c', 'b']);
  expect(
    restored.addRound({
      winnerId: 'a',
      loserIds: ['a'],
      amount: 2.4,
      gameType: 'rufspiel',
    }),
  ).toBe(false);
  expect(useGameStore.getState().currentTable?.placedLegerPlayerIds).toEqual([
    'a',
    'b',
  ]);
  expect(
    restored.addRound({
      winnerId: 'a',
      loserIds: ['b', 'c'],
      amount: 2.4,
      gameType: 'rufspiel',
    }),
  ).toBe(true);
  expect(useGameStore.getState().currentTable).toMatchObject({
    placedLegerPlayerIds: [],
    dealerId: 'c',
    turboRamschEnabled: true,
  });
});
it('rejects unknown Leger players, toggles each contribution once and protects closed tables', () => {
  useGameStore.getState().createTable('Leger', makePlayers());
  useGameStore.getState().togglePlayerLeger('unknown');
  expect(
    useGameStore.getState().currentTable?.placedLegerPlayerIds ?? [],
  ).toEqual([]);
  useGameStore.getState().togglePlayerLeger('a');
  expect(useGameStore.getState().currentTable?.placedLegerPlayerIds).toEqual([
    'a',
  ]);
  useGameStore.getState().togglePlayerLeger('a');
  expect(useGameStore.getState().currentTable?.placedLegerPlayerIds).toEqual(
    [],
  );
  useGameStore.getState().finishGameDay();
  const closed = useGameStore.getState().currentTable;
  useGameStore.getState().togglePlayerLeger('b');
  expect(useGameStore.getState().currentTable).toBe(closed);
});
