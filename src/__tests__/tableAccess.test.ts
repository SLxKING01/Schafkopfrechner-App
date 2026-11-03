import { sharedSnapshot } from '../services/shared/sharedTables';
import { validateStoredValue } from '../storage/validateGameState';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { emptyTariffOptions } from '../utils/roundTariff';
import { tableAccess } from '../utils/tableAccess';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
const payload = {
  gameType: 'rufspiel' as const,
  winnerId: 'a',
  winnerIds: ['a', 'b'],
  loserIds: ['c', 'd'],
  amount: 0.4,
  tariffOptions: { ...emptyTariffOptions },
};
function role(value: 'read' | 'write', userId = 'member') {
  useAuthStore.setState({ user: { id: userId } as never });
  const table = useGameStore.getState().currentTable!;
  useGameStore.setState({
    currentTable: {
      ...table,
      shared: {
        role: value,
        userId,
        ownerId: 'owner',
        version: 1,
        baseline: '{}',
        updatedAt: new Date().toISOString(),
      },
    },
  });
}
beforeEach(() => {
  useGameStore.setState({
    currentTable: null,
    activeGame: false,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
  });
  useGameStore.getState().createTable(
    'Berechtigungen',
    ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, isLocal: true })),
  );
});

it('blocks every local mutation for readers and mismatched accounts', () => {
  role('read');
  const before = sharedSnapshot();
  const state = useGameStore.getState();
  expect(state.addRound(payload)).toBe(false);
  expect(state.setPlayerOrder(['d', 'c', 'b', 'a'])).toBe(false);
  expect(state.setPlayerPaused(state.currentTable!.id, 'a', true)).toBe(false);
  expect(state.setDealer(state.currentTable!.id, 'b')).toBe(false);
  expect(state.setPlayerAccount('b', 'other')).toBe(false);
  expect(state.finishGameDay()).toBe(false);
  expect(state.updateCurrentTableSettings(state.currentTable!.settings)).toBe(
    false,
  );
  state.togglePlayerLeger('a');
  state.setTurboRamsch(true);
  state.removePlayer('a');
  expect(sharedSnapshot()).toEqual(before);
  expect(tableAccess(state.currentTable, 'unrelated')).toEqual({
    canWrite: false,
    canManage: false,
  });
});

it('lets writers create, correct, delete and restore rounds, but not manage the table', () => {
  role('write');
  const state = useGameStore.getState();
  expect(state.addRound(payload)).toBe(true);
  const round = useGameStore.getState().rounds[0];
  expect(
    state.updateRound(round.id, {
      ...payload,
      winnerId: 'c',
      winnerIds: ['c', 'd'],
      loserIds: ['a', 'b'],
    }),
  ).toBe(true);
  expect(state.setPlayerOrder(['d', 'c', 'b', 'a'])).toBe(false);
  expect(state.finishGameDay()).toBe(false);
  expect(state.updateCurrentTableSettings(state.currentTable!.settings)).toBe(
    false,
  );
  expect(state.undoLastRound()).toBe(true);
  expect(state.restoreRound(state.currentTable!.id, round.id)).toBe(true);
  expect(useGameStore.getState().rounds[0].id).toBe(round.id);
  role('read');
  expect(state.updateRound(round.id, payload)).toBe(false);
  expect(state.undoLastRound()).toBe(false);
});

it('retains management for the owner and fails closed on old bindings without a role', () => {
  role('read', 'owner');
  expect(tableAccess(useGameStore.getState().currentTable, 'owner')).toEqual({
    canWrite: true,
    canManage: true,
  });
  role('write');
  const table = useGameStore.getState().currentTable!;
  expect(
    tableAccess(
      { ...table, shared: { ...table.shared!, role: undefined } },
      'member',
    ).canWrite,
  ).toBe(false);
});

it('accepts real conflict and account-switch backups at the durable storage boundary', () => {
  const snapshot = sharedSnapshot()!;
  expect(
    validateStoredValue('shared-conflict-backup:member:table:1', snapshot),
  ).toBe(true);
  expect(validateStoredValue('shared-before-open:member:1', null)).toBe(true);
  expect(
    validateStoredValue('shared-account-cache:member:1', {
      current: useGameStore.getState(),
      archived: [],
    }),
  ).toBe(true);
  expect(
    validateStoredValue('shared-conflict-backup:member:table:1', {
      rounds: [],
    }),
  ).toBe(false);
});
