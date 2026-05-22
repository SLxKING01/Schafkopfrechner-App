import { useGameStore } from '../store/gameStore';
import type { Player } from '../types/game';

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

function createActiveTable() {
  const didCreate = useGameStore.getState().createTable('Freitag', players);

  expect(didCreate).toBe(true);
}

describe('gameStore round validation', () => {
  beforeEach(() => {
    resetGameStore();
    createActiveTable();
  });

  it.each([Number.NaN, Infinity, -Infinity, 0, -5])(
    'rejects invalid round amount %s without corrupting balances',
    (amount) => {
      const didAdd = useGameStore.getState().addRound({
        amount,
        gameType: 'sauspiel',
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
      gameType: 'sauspiel',
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
