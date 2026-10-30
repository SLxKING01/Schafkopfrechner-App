import AsyncStorage from '@react-native-async-storage/async-storage';

import { useGameStore } from '../store/gameStore';
import type { Player } from '../types/game';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('../services/sync/syncGameTable', () => ({
  syncGameTable: jest.fn(async () => ({ syncedAt: null })),
}));

jest.mock('../services/sync/syncRounds', () => ({
  syncRounds: jest.fn(async () => ({ syncedAt: null })),
}));

jest.mock('../services/sync/syncSettlements', () => ({
  syncSettlements: jest.fn(async () => ({ syncedAt: null })),
}));

const players: Player[] = [
  {
    id: 'player-1',
    isLocal: true,
    name: 'Simon',
  },
  {
    id: 'player-2',
    isLocal: true,
    name: 'Berkay',
  },
];

function resetGameStore() {
  useGameStore.setState({
    archivedTables: [],
    activeGame: false,
    balances: [],
    currentTable: null,
    games: [],
    isOffline: false,
    lastSyncedAt: null,
    players: [],
    rounds: [],
    settlements: [],
    syncing: false,
    tableOrderIds: [],
  });
}

async function createActiveTable() {
  const didCreate = await useGameStore
    .getState()
    .createTable('Freitag', players);

  expect(didCreate).toBe(true);
}

describe('gameStore round validation', () => {
  beforeEach(async () => {
    resetGameStore();
    await createActiveTable();
  });

  it.each([Number.NaN, Infinity, -Infinity, 0, -5])(
    'rejects invalid round amount %s without corrupting balances',
    (amount) => {
      const didAdd = useGameStore.getState().addRound({
        amount,
        gameType: 'solo',
        loserIds: ['player-2'],
        winnerId: 'player-1',
      });
      const state = useGameStore.getState();

      expect(didAdd).toBe(false);
      expect(state.rounds).toHaveLength(0);
      expect(
        state.balances.every((balance) => Number.isFinite(balance.amount)),
      ).toBe(true);
    },
  );

  it('adds valid finite round amounts and keeps balances finite', () => {
    const didAdd = useGameStore.getState().addRound({
      amount: 10,
      gameType: 'solo',
      loserIds: ['player-2'],
      winnerId: 'player-1',
    });
    const state = useGameStore.getState();

    expect(didAdd).toBe(true);
    expect(state.rounds).toHaveLength(1);
    expect(state.balances).toEqual([
      { amount: 10, playerId: 'player-1' },
      { amount: -10, playerId: 'player-2' },
    ]);
  });
});

describe('mobile audit regressions', () => {
  beforeEach(resetGameStore);

  it('rejects unknown or duplicate participants instead of dropping their balances', async () => {
    await createActiveTable();
    for (const loserIds of [['missing'], ['player-2', 'player-2']]) {
      expect(
        useGameStore.getState().addRound({
          winnerId: 'player-1',
          loserIds,
          amount: 10,
          gameType: 'solo',
        }),
      ).toBe(false);
    }
    expect(useGameStore.getState().rounds).toHaveLength(0);
  });

  it('splits a Rufspiel between two winners and two losers with exact cents', async () => {
    const fourPlayers = [
      ...players,
      { id: 'player-3', name: 'Anna', isLocal: true },
      { id: 'player-4', name: 'Max', isLocal: true },
    ];
    await useGameStore.getState().createTable('Rufspiel', fourPlayers);
    expect(
      useGameStore.getState().addRound({
        winnerId: 'player-1',
        winnerIds: ['player-1', 'player-2'],
        loserIds: ['player-3', 'player-4'],
        amount: 10.01,
        gameType: 'rufspiel',
      }),
    ).toBe(true);
    expect(
      useGameStore.getState().balances.map((entry) => entry.amount),
    ).toEqual([5.01, 5, -5.01, -5]);
    expect(
      useGameStore.getState().addRound({
        winnerId: 'player-1',
        loserIds: ['player-2'],
        amount: 10,
        gameType: 'rufspiel',
      }),
    ).toBe(false);
    useGameStore.getState().removePlayer('player-2');
    expect(useGameStore.getState().players).toHaveLength(4);
  });

  it('archives on replacement and reset, preserving rounds, names and payments after hydration', async () => {
    await createActiveTable();
    useGameStore.getState().addRound({
      winnerId: 'player-1',
      loserIds: ['player-2'],
      amount: 10,
      gameType: 'solo',
    });
    useGameStore.getState().finishGameDay();
    const old = useGameStore.getState();
    const tableId = old.currentTable!.id;
    await useGameStore.getState().createTable('Samstag', players);
    expect(useGameStore.getState().archivedTables[0]).toMatchObject({
      players,
      rounds: old.rounds,
      settlements: old.settlements,
      balances: old.balances,
    });
    await useGameStore.getState().resetGame();
    await useGameStore.getState().resetGame();
    expect(useGameStore.getState().archivedTables).toHaveLength(2);
    await useGameStore.getState().persistGame();
    const saved = await AsyncStorage.getItem('schafkopfrechner-games');
    resetGameStore();
    await useGameStore.getState().persistGame();
    await AsyncStorage.setItem('schafkopfrechner-games', saved!);
    await useGameStore.getState().hydrateGame();
    expect(useGameStore.getState().archivedTables).toHaveLength(2);
    const payment = useGameStore.getState().archivedTables[0].settlements[0];
    useGameStore.getState().markSettlementPaid(payment.id, tableId);
    expect(
      useGameStore.getState().archivedTables[0].settlements[0].isPaid,
    ).toBe(true);
    expect(useGameStore.getState().settlements).toEqual([]);
  });
});
