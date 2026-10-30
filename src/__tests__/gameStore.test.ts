import { useGameStore } from '../store/gameStore';
import type { Player } from '../types/game';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
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
    archivedGameDays: [],
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

  it('can undo a paid settlement without changing the round or balances', () => {
    useGameStore.getState().addRound({
      amount: 10,
      gameType: 'sauspiel',
      loserIds: ['player-2'],
      winnerId: 'player-1',
    });
    useGameStore.getState().finishGameDay();
    const { settlements, rounds, balances } = useGameStore.getState();
    const settlement = settlements[0];

    useGameStore.getState().markSettlementPaid(settlement.id);
    expect(useGameStore.getState().settlements[0].isPaid).toBe(true);
    useGameStore.getState().markSettlementPaid(settlement.id, false);

    expect(useGameStore.getState().settlements[0]).toEqual(settlement);
    expect(useGameStore.getState().rounds).toEqual(rounds);
    expect(useGameStore.getState().balances).toEqual(balances);
  });
});

describe('accounting invariants at the table boundary', () => {
  beforeEach(() => {
    resetGameStore();
    createActiveTable();
  });
  it.each([
    { winnerId: 'ghost', loserIds: ['player-2'], amount: 1 },
    { winnerId: 'player-1', loserIds: ['ghost'], amount: 1 },
    { winnerId: 'player-1', loserIds: ['player-2', 'player-2'], amount: 1 },
    { winnerId: 'player-1', loserIds: ['player-1'], amount: 1 },
    { winnerId: 'player-1', loserIds: [], amount: 1 },
    { winnerId: 'player-1', loserIds: ['player-2'], amount: 0.001 },
    { winnerId: 'player-1', loserIds: ['player-2'], amount: 1.005 },
    { winnerId: 'player-1', loserIds: ['player-2'], amount: Number.MAX_VALUE },
  ])(
    'rejects an invalid round without changing balances or advancing the dealer %#',
    (input) => {
      const before = useGameStore.getState();
      expect(before.addRound({ ...input, gameType: 'rufspiel' })).toBe(false);
      const after = useGameStore.getState();
      expect(after.rounds).toEqual(before.rounds);
      expect(after.balances).toEqual(before.balances);
      expect(after.settlements).toEqual(before.settlements);
      expect(after.currentTable).toEqual(before.currentTable);
    },
  );
  it('stores canonical cents and copies participant ids', () => {
    const losers = ['player-2'];
    expect(
      useGameStore.getState().addRound({
        winnerId: 'player-1',
        loserIds: losers,
        amount: 0.1 + 0.2,
        gameType: 'rufspiel',
      }),
    ).toBe(true);
    losers.push('player-1');
    expect(useGameStore.getState().rounds[0]).toMatchObject({
      amount: 0.3,
      loserIds: ['player-2'],
    });
  });
  it('rejects cumulative integer overflow without losing the first valid round', () => {
    const input = {
      winnerId: 'player-1',
      loserIds: ['player-2'],
      gameType: 'rufspiel' as const,
    };
    expect(
      useGameStore
        .getState()
        .addRound({ ...input, amount: Number.MAX_SAFE_INTEGER / 100 }),
    ).toBe(true);
    const before = useGameStore.getState();
    expect(before.addRound({ ...input, amount: 0.01 })).toBe(false);
    expect(useGameStore.getState().rounds).toEqual(before.rounds);
    expect(useGameStore.getState().balances).toEqual(before.balances);
  });
  it('will not archive corrupt rounds or silently drop unknown players', () => {
    useGameStore.getState().addRound({
      winnerId: 'player-1',
      loserIds: ['player-2'],
      amount: 1,
      gameType: 'solo',
    });
    const round = useGameStore.getState().rounds[0];
    useGameStore.setState({ rounds: [{ ...round, winnerId: 'ghost' }] });
    expect(useGameStore.getState().finishGameDay()).toBe(false);
    expect(useGameStore.getState().activeGame).toBe(true);
    expect(useGameStore.getState().archivedGameDays).toEqual([]);
  });
  it('recomputes final balances from valid rounds instead of trusting a stale cache', () => {
    useGameStore.getState().addRound({
      winnerId: 'player-1',
      loserIds: ['player-2'],
      amount: 1,
      gameType: 'solo',
    });
    useGameStore.setState({
      balances: [{ playerId: 'player-1', amount: 999 }],
    });
    expect(useGameStore.getState().finishGameDay()).toBe(true);
    expect(useGameStore.getState().balances).toEqual([
      { playerId: 'player-1', amount: 1 },
      { playerId: 'player-2', amount: -1 },
    ]);
  });
  it('rejects duplicate player ids when creating a table', () => {
    resetGameStore();
    expect(
      useGameStore
        .getState()
        .createTable('Ungültig', [
          players[0],
          { ...players[1], id: players[0].id },
        ]),
    ).toBe(false);
    expect(useGameStore.getState().currentTable).toBeNull();
  });
});
