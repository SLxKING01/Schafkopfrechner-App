import {
  loadSharedTableAfterConflict,
  openSharedTable,
  publishSharedTable,
  refreshSharedTables,
  sharedSnapshot,
  syncSharedTable,
  useSharedTableStatus,
} from '../services/shared/sharedTables';
import { reliableStorage } from '../storage/reliableStorage';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { paymentRevision } from '../utils/interimPayments';
import { emptyTariffOptions } from '../utils/roundTariff';

const mockRpc = jest.fn();
const mockList = jest.fn();
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({ order: () => ({ abortSignal: () => mockList() }) }),
    }),
    rpc: (...args: unknown[]) => ({ abortSignal: () => mockRpc(...args) }),
  },
}));
jest.mock('../storage/reliableStorage', () => ({
  reliableStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    confirmWrite: jest.fn(async () => true),
    flush: jest.fn(async () => {}),
  },
  getStorageIssues: () => [],
}));
let remote: {
  id: string;
  payload: NonNullable<ReturnType<typeof sharedSnapshot>>;
  version: number;
  code: string;
  updatedAt: string;
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function actor(id: string) {
  useAuthStore.setState({ user: { id } as never });
}
function clearTable() {
  useGameStore.setState({
    currentTable: null,
    activeGame: false,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  actor('phone-a');
  clearTable();
  useSharedTableStatus.setState({ conflict: null, error: null, busy: false });
  useGameStore.getState().createTable(
    'Gemeinsamer Tisch',
    ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, isLocal: true })),
  );
  mockList.mockImplementation(async () => ({
    data: remote
      ? [
          {
            id: remote.id,
            payload: clone(remote.payload),
            version: remote.version,
            updated_at: remote.updatedAt,
            owner_id: 'phone-a',
          },
        ]
      : [],
    error: null,
  }));
  mockRpc.mockImplementation(
    async (
      _name: string,
      params: {
        p_action: string;
        p_payload: typeof remote.payload;
        p_version: number;
      },
    ) => {
      if (params.p_action === 'create')
        remote = {
          id: params.p_payload.currentTable.id,
          payload: clone(params.p_payload),
          version: 1,
          code: 'shared-code',
          updatedAt: new Date().toISOString(),
        };
      if (params.p_action === 'save') {
        if (params.p_version !== remote.version)
          return { data: null, error: { message: 'Version conflict' } };
        remote = {
          ...remote,
          payload: clone(params.p_payload),
          version: remote.version + 1,
        };
      }
      return { data: clone(remote), error: null };
    },
  );
});
it('shares games and tariffs across two independent accounts without transferring private account data', async () => {
  await publishSharedTable();
  expect(remote.payload.currentTable.shared).toBeUndefined();
  expect(
    useGameStore.getState().addRound({
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
      amount: 0.4,
      gameType: 'rufspiel',
      tariffOptions: { ...emptyTariffOptions },
    }),
  ).toBe(true);
  await syncSharedTable();
  const phoneA = clone(useGameStore.getState().currentTable);
  const snapshotA = clone(sharedSnapshot()!);
  actor('phone-b');
  clearTable();
  await openSharedTable(remote.id);
  expect(sharedSnapshot()).toEqual(snapshotA);
  const settings = clone(useGameStore.getState().currentTable!.settings);
  settings.games.rufspiel.value = 0.5;
  useGameStore.getState().updateCurrentTableSettings(settings, 'all');
  await syncSharedTable();
  expect(remote.payload.rounds[0].amount).toBe(1);
  actor('phone-a');
  useGameStore.setState({ ...snapshotA, currentTable: phoneA });
  await syncSharedTable();
  expect(useGameStore.getState().rounds[0].amount).toBe(1);
  expect(useGameStore.getState().currentTable!.shared!.version).toBe(
    remote.version,
  );
});
it('preserves unsent local changes on conflict, then backs them up before loading the shared state', async () => {
  await publishSharedTable();
  useGameStore.getState().setTurboRamsch(true);
  remote = {
    ...remote,
    payload: {
      ...remote.payload,
      currentTable: {
        ...remote.payload.currentTable,
        name: 'Changed on other phone',
      },
    },
    version: 2,
  };
  await syncSharedTable();
  expect(useSharedTableStatus.getState().conflict).not.toBeNull();
  expect(useGameStore.getState().currentTable!.turboRamschEnabled).toBe(true);
  expect(remote.payload.currentTable.turboRamschEnabled).not.toBe(true);
  await loadSharedTableAfterConflict();
  expect(reliableStorage.setItem).toHaveBeenCalledWith(
    expect.stringContaining('shared-conflict-backup:'),
    expect.stringContaining('turboRamschEnabled'),
  );
  expect(useGameStore.getState().currentTable!.name).toBe(
    'Changed on other phone',
  );
  expect(useSharedTableStatus.getState().conflict).toBeNull();
});
it('retains local games when the network fails and retries them later', async () => {
  await publishSharedTable();
  useGameStore.getState().setTurboRamsch(true);
  mockRpc.mockRejectedValueOnce(new Error('Offline'));
  await syncSharedTable();
  expect(useSharedTableStatus.getState().error).toBe('Offline');
  expect(useGameStore.getState().currentTable!.turboRamschEnabled).toBe(true);
  await syncSharedTable();
  expect(remote.payload.currentTable.turboRamschEnabled).toBe(true);
});
it('ignores responses after an account switch', async () => {
  await publishSharedTable();
  remote = {
    ...remote,
    version: 2,
    payload: {
      ...remote.payload,
      currentTable: { ...remote.payload.currentTable, name: 'Remote' },
    },
  };
  mockRpc.mockImplementationOnce(async () => {
    actor('other-account');
    return { data: clone(remote), error: null };
  });
  await syncSharedTable();
  expect(useGameStore.getState().currentTable!.name).toBe('Gemeinsamer Tisch');
});
it('does not overwrite an active local table when opening another table', async () => {
  await expect(openSharedTable('other-table')).rejects.toThrow(
    'aktuelle Tisch',
  );
  expect(mockRpc).not.toHaveBeenCalled();
});

it('uploads a closed shared table even after the next local table has started', async () => {
  await publishSharedTable();
  const sharedId = useGameStore.getState().currentTable!.id;
  expect(useGameStore.getState().finishGameDay()).toBe(true);
  expect(
    useGameStore.getState().createTable(
      'Nächster Tisch',
      ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, isLocal: true })),
    ),
  ).toBe(true);
  await syncSharedTable();
  expect(remote.id).toBe(sharedId);
  expect(remote.payload.activeGame).toBe(false);
  expect(useGameStore.getState().currentTable!.name).toBe('Nächster Tisch');
});

it('discovers a table assigned to the signed-in player without a code', async () => {
  await publishSharedTable();
  actor('phone-b');
  clearTable();
  await refreshSharedTables();
  expect(useSharedTableStatus.getState().tables[0].id).toBe(remote.id);
  expect(useSharedTableStatus.getState().tablesUserId).toBe('phone-b');
  await openSharedTable(remote.id);
  expect(useGameStore.getState().currentTable!.id).toBe(remote.id);
});
it('automatically publishes a local table associated with the current account', async () => {
  const first = useGameStore.getState().players[0];
  expect(useGameStore.getState().setPlayerAccount(first.id, 'phone-a')).toBe(
    true,
  );
  await syncSharedTable();
  expect(useGameStore.getState().currentTable!.shared).toBeDefined();
  expect(remote.payload.players[0].userId).toBe('phone-a');
});

it('hides the previous accounts shared table even when discovery is offline', async () => {
  await publishSharedTable();
  actor('phone-b');
  mockList.mockRejectedValueOnce(new Error('Offline'));
  await refreshSharedTables();
  expect(useGameStore.getState().currentTable).toBeNull();
  expect(reliableStorage.setItem).toHaveBeenCalledWith(
    expect.stringContaining('shared-account-cache:'),
    expect.any(String),
  );
});

it('does not remove a newly published table when an older discovery request returns', async () => {
  let finish!: (value: { data: []; error: null }) => void;
  mockList.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const discovering = refreshSharedTables();
  await Promise.resolve();
  await publishSharedTable();
  finish({ data: [], error: null });
  await discovering;
  expect(useGameStore.getState().currentTable!.shared).toBeDefined();
});

it('preserves payment journals and round history across accounts, restoration and subsequent uploads', async () => {
  const store = useGameStore.getState();
  expect(
    store.addRound({
      gameType: 'rufspiel',
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
      declarerId: 'a',
      partnerId: 'b',
      amount: 0.4,
      tariffOptions: { ...emptyTariffOptions },
    }),
  ).toBe(true);
  const state = useGameStore.getState();
  const id = state.rounds[0].id;
  expect(
    store.recordInterimPayment(
      state.currentTable!.id,
      paymentRevision(state.currentTable!, state.balances),
      { id: 'shared-paid', fromPlayerId: 'c', toPlayerId: 'a', amount: 0.1 },
    ),
  ).toBe(true);
  const paid = clone(useGameStore.getState().currentTable!.interimPayments);
  const history = clone(useGameStore.getState().currentTable!.roundHistory);
  await publishSharedTable();
  actor('phone-b');
  clearTable();
  await openSharedTable(remote.id);
  expect(useGameStore.getState().currentTable!.interimPayments).toEqual(paid);
  expect(useGameStore.getState().currentTable!.roundHistory).toEqual(history);
  expect(store.undoLastRound()).toBe(true);
  expect(store.restoreRound(remote.id, id)).toBe(true);
  await syncSharedTable();
  expect(remote.payload.currentTable.interimPayments).toEqual(paid);
  expect(remote.payload.currentTable.roundHistory!.at(-1)).toMatchObject({
    action: 'restored',
    actor: { id: 'phone-b' },
  });
  actor('phone-a');
  clearTable();
  await openSharedTable(remote.id);
  expect(useGameStore.getState().rounds).toHaveLength(1);
  expect(useGameStore.getState().rounds[0].id).toBe(id);
  expect(useGameStore.getState().currentTable!.interimPayments).toEqual(paid);
});
