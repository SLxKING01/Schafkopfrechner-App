import {
  loadSharedTableAfterConflict,
  openSharedTable,
  publishSharedTable,
  refreshSharedTables,
  saveSharedRound,
  sharedSnapshot,
  syncSharedTable,
  useSharedTableStatus,
} from '../services/shared/sharedTables';
import { reliableStorage } from '../storage/reliableStorage';
import { validGameSnapshot } from '../storage/validateGameState';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import type { CreateRoundPayload } from '../types/game';
import { getStockBalanceCents } from '../utils/accounting';
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
            sk_live_members: [{ role: 'write' }],
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
      return {
        data: { ...clone(remote), ownerId: 'phone-a', role: 'write' },
        error: null,
      };
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
  expect(
    useGameStore.getState().updateRound(remote.payload.rounds[0].id, {
      ...remote.payload.rounds[0],
      amount: 0.8,
      tariffOptions: { ...emptyTariffOptions, legerCount: 1 },
      legerPlayerIds: ['a'],
    }),
  ).toBe(true);
  await syncSharedTable();
  expect(remote.payload.rounds[0].amount).toBe(0.8);
  actor('phone-a');
  useGameStore.setState({ ...snapshotA, currentTable: phoneA });
  await syncSharedTable();
  expect(useGameStore.getState().rounds[0].amount).toBe(0.8);
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

it('revokes writing before upload while preserving an offline draft as a conflict', async () => {
  await publishSharedTable();
  actor('phone-b');
  clearTable();
  await openSharedTable(remote.id);
  expect(
    useGameStore.getState().addRound({
      gameType: 'rufspiel',
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
      amount: 0.4,
      tariffOptions: { ...emptyTariffOptions },
    }),
  ).toBe(true);
  const local = clone(sharedSnapshot());
  mockRpc.mockClear();
  mockRpc.mockImplementation(async () => ({
    data: { ...clone(remote), ownerId: 'phone-a', role: 'read' },
    error: null,
  }));
  await syncSharedTable();
  expect(sharedSnapshot()).toEqual(local);
  expect(useGameStore.getState().currentTable!.shared!.role).toBe('read');
  expect(useSharedTableStatus.getState().error).toContain(
    'Schreibrecht wurde entzogen',
  );
  expect(useSharedTableStatus.getState().conflict).not.toBeNull();
  expect(
    mockRpc.mock.calls.some(([, params]) => params.p_action === 'save'),
  ).toBe(false);
});

it('does not overwrite a newer remote correction when an offline creation undo is synchronized', async () => {
  await publishSharedTable();
  const payload = {
    gameType: 'rufspiel' as const,
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    amount: 0.4,
    tariffOptions: { ...emptyTariffOptions },
  };
  expect(useGameStore.getState().addRound(payload)).toBe(true);
  await syncSharedTable();
  const saved = clone(sharedSnapshot()!);
  const binding = clone(useGameStore.getState().currentTable!);
  const created = binding.roundHistory!.at(-1)!;
  actor('phone-b');
  clearTable();
  await openSharedTable(remote.id);
  expect(
    useGameStore.getState().updateRound(created.roundId, {
      ...payload,
      winnerId: 'c',
      winnerIds: ['c', 'd'],
      loserIds: ['a', 'b'],
    }),
  ).toBe(true);
  await syncSharedTable();
  const corrected = clone(remote.payload);
  actor('phone-a');
  useGameStore.setState({ ...saved, currentTable: binding });
  expect(
    useGameStore.getState().revertRoundChange(binding.id, created.id),
  ).toBe(true);
  await syncSharedTable();
  expect(remote.payload).toEqual(corrected);
  expect(useSharedTableStatus.getState().conflict).not.toBeNull();
  expect(useGameStore.getState().rounds).toHaveLength(0);
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
    return {
      data: { ...clone(remote), ownerId: 'phone-a', role: 'write' },
      error: null,
    };
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

const addSolo = (winnerId = 'a') => {
  expect(
    useGameStore.getState().addRound({
      winnerId,
      loserIds: ['a', 'b', 'c', 'd'].filter((id) => id !== winnerId),
      gameType: 'solo',
      amount: 0.6,
    }),
  ).toBe(true);
};
function changeNewRoundClock(createdAt: string) {
  useGameStore.setState((state) => ({
    rounds: state.rounds.map((r) => ({ ...r, createdAt })),
    currentTable: {
      ...state.currentTable!,
      roundHistory: state.currentTable!.roundHistory!.map((e) => ({
        ...e,
        after: e.after ? { ...e.after, createdAt } : undefined,
      })),
    },
  }));
}

it('retains independent offline additions from two accounts in server acceptance order, regardless of their clocks', async () => {
  await publishSharedTable();
  const baseline = clone(useGameStore.getState().currentTable);
  const initial = clone(sharedSnapshot()!);
  addSolo('a');
  changeNewRoundClock('2030-01-01T00:00:00.000Z');
  const firstId = useGameStore.getState().rounds[0].id;
  await syncSharedTable();
  actor('phone-b');
  useGameStore.setState({
    ...initial,
    currentTable: {
      ...baseline!,
      shared: { ...baseline!.shared!, userId: 'phone-b' },
    },
  });
  addSolo('b');
  changeNewRoundClock('2020-01-01T00:00:00.000Z');
  const secondId = useGameStore.getState().rounds[0].id;
  await syncSharedTable();
  expect(useSharedTableStatus.getState().conflict).toBeNull();
  expect(remote.payload.rounds.map((r) => r.id)).toEqual([firstId, secondId]);
  expect(useGameStore.getState().rounds).toEqual(remote.payload.rounds);
  expect(remote.payload.currentTable.dealerId).toBe('c');
  expect(
    remote.payload.currentTable.roundHistory!.map((e) => [
      e.sequence,
      e.actor.kind === 'account' && e.actor.id,
    ]),
  ).toEqual([
    [1, 'phone-a'],
    [2, 'phone-b'],
  ]);
  const version = remote.version;
  await syncSharedTable();
  expect(remote.version).toBe(version);
  expect(remote.payload.rounds).toHaveLength(2);
});

it('rebases after a compare-and-swap race rather than sending a stale whole-table snapshot', async () => {
  await publishSharedTable();
  const initial = clone(sharedSnapshot()!);
  const meta = clone(useGameStore.getState().currentTable);
  addSolo('b');
  const other = clone(sharedSnapshot()!);
  useGameStore.setState({ ...initial, currentTable: meta });
  addSolo('a');
  const implementation = mockRpc.getMockImplementation()!;
  let raced = false;
  mockRpc.mockImplementation(async (name, params) => {
    if (params.p_action === 'save' && !raced) {
      raced = true;
      remote = { ...remote, payload: other, version: remote.version + 1 };
      return {
        data: null,
        error: { code: 'PT409', message: 'Concurrent write' },
      };
    }
    return implementation(name, params);
  });
  await syncSharedTable();
  expect(remote.payload.rounds).toHaveLength(2);
  expect(remote.payload.rounds[0].id).toBe(other.rounds[0].id);
  expect(useSharedTableStatus.getState().error).toBeNull();
});

it('recovers a lost upload acknowledgement idempotently without duplicating balances or history', async () => {
  await publishSharedTable();
  addSolo();
  const implementation = mockRpc.getMockImplementation()!;
  mockRpc.mockImplementation(async (name, params) => {
    const result = await implementation(name, params);
    if (params.p_action === 'save')
      throw new Error('Connection lost after commit');
    return result;
  });
  await syncSharedTable();
  const accepted = clone(remote.payload);
  mockRpc.mockImplementation(implementation);
  await syncSharedTable();
  expect(sharedSnapshot()).toEqual(accepted);
  expect(remote.payload.rounds).toHaveLength(1);
  expect(remote.payload.currentTable.roundHistory).toHaveLength(1);
});

it('keeps edits to the same game as a visible conflict instead of replacing the newer correction', async () => {
  addSolo();
  await publishSharedTable();
  const original = clone(sharedSnapshot()!);
  const meta = clone(useGameStore.getState().currentTable);
  const round = original.rounds[0];
  expect(
    useGameStore.getState().updateRound(round.id, { ...round, amount: 0.9 }),
  ).toBe(true);
  await syncSharedTable();
  const accepted = clone(remote.payload);
  useGameStore.setState({ ...original, currentTable: meta });
  expect(
    useGameStore.getState().updateRound(round.id, { ...round, amount: 1.2 }),
  ).toBe(true);
  await syncSharedTable();
  expect(remote.payload).toEqual(accepted);
  expect(useGameStore.getState().rounds[0].amount).toBe(1.2);
  expect(useSharedTableStatus.getState().conflict).not.toBeNull();
});

it('replays concurrent stock-dependent games in accepted order with balanced cents and valid audit snapshots', async () => {
  const settings = clone(useGameStore.getState().currentTable!.settings);
  settings.games.stock.enabled = true;
  settings.games.ramsch.enabled = false;
  useGameStore.getState().updateCurrentTableSettings(settings);
  const deposit = () =>
    expect(
      useGameStore.getState().addRound({
        gameType: 'stock',
        winnerId: '',
        winnerIds: [],
        loserIds: ['a', 'b', 'c', 'd'],
        amount: 0.8,
        stockAction: 'deposit',
      }),
    ).toBe(true);
  deposit();
  await publishSharedTable();
  const initial = clone(sharedSnapshot()!);
  const meta = clone(useGameStore.getState().currentTable);
  deposit();
  await syncSharedTable();
  useGameStore.setState({ ...initial, currentTable: meta });
  expect(
    useGameStore.getState().addRound({
      gameType: 'rufspiel',
      declarerId: 'a',
      partnerId: 'b',
      winnerId: 'a',
      winnerIds: ['a', 'b'],
      loserIds: ['c', 'd'],
      amount: 0.4,
    }),
  ).toBe(true);
  expect(useGameStore.getState().rounds[1].stockBeforeCents).toBe(80);
  await syncSharedTable();
  expect(useSharedTableStatus.getState().conflict).toBeNull();
  expect(remote.payload.rounds[2]).toMatchObject({
    stockBeforeCents: 160,
    stockAfterCents: 0,
    stockAction: 'payout',
  });
  expect(getStockBalanceCents(remote.payload.rounds)).toBe(0);
  expect(
    remote.payload.balances.reduce(
      (sum, b) => sum + Math.round(b.amount * 100),
      0,
    ),
  ).toBe(0);
  expect(validGameSnapshot(remote.payload)).toBe(true);
  await syncSharedTable();
  expect(remote.payload.rounds).toHaveLength(3);
});

it('keeps additions made while a merged upload is in flight and uploads them on the next sync', async () => {
  await publishSharedTable();
  const initial = clone(sharedSnapshot()!);
  const meta = clone(useGameStore.getState().currentTable);
  addSolo('a');
  await syncSharedTable();
  useGameStore.setState({ ...initial, currentTable: meta });
  addSolo('b');
  const implementation = mockRpc.getMockImplementation()!;
  let edited = false;
  mockRpc.mockImplementation(async (name, params) => {
    const result = await implementation(name, params);
    if (params.p_action === 'save' && !edited) {
      edited = true;
      addSolo('c');
    }
    return result;
  });
  await syncSharedTable();
  expect(useGameStore.getState().rounds).toHaveLength(3);
  expect(remote.payload.rounds).toHaveLength(2);
  expect(useSharedTableStatus.getState().conflict).toBeNull();
  await syncSharedTable();
  expect(remote.payload.rounds).toHaveLength(3);
  expect(sharedSnapshot()).toEqual(remote.payload);
});

const entryPayload: CreateRoundPayload = {
  gameType: 'rufspiel',
  winnerId: 'a',
  winnerIds: ['a', 'b'],
  loserIds: ['c', 'd'],
  amount: 0.4,
  tariffOptions: { ...emptyTariffOptions },
};
function anotherPhoneAddsRound(payload = entryPayload) {
  const local = useGameStore.getState();
  actor('phone-b');
  useGameStore.setState({
    ...clone(remote.payload),
    currentTable: {
      ...clone(remote.payload.currentTable),
      shared: {
        ...local.currentTable!.shared!,
        userId: 'phone-b',
        role: 'write',
      },
    },
  });
  expect(useGameStore.getState().addRound(payload)).toBe(true);
  remote = {
    ...remote,
    version: remote.version + 1,
    payload: clone(sharedSnapshot()!),
  };
  actor('phone-a');
  useGameStore.setState(local);
  return remote.payload.rounds.at(-1)!;
}
it('warns about played rounds but ignores pure stock bookings', async () => {
  const settings = clone(useGameStore.getState().currentTable!.settings);
  settings.games.stock.enabled = true;
  settings.games.ramsch.enabled = false;
  useGameStore.getState().updateCurrentTableSettings(settings);
  await publishSharedTable();
  const booking = anotherPhoneAddsRound({
    gameType: 'stock',
    winnerId: '',
    winnerIds: [],
    loserIds: ['a', 'b', 'c', 'd'],
    amount: 0.8,
    stockAction: 'deposit',
  });
  const played = anotherPhoneAddsRound({
    ...entryPayload,
    tariffOptions: undefined,
    declarerId: 'a',
    partnerId: 'b',
  });
  const result = await saveEntry('only-played-rounds');
  if (!('review' in result)) throw Error('Expected review');
  expect(result.review.rounds.map(({ round }) => round.id)).toEqual([
    played.id,
  ]);
  expect(remote.payload.rounds.map(({ id }) => id)).toEqual([
    booking.id,
    played.id,
  ]);
});
function saveEntry(id: string, known: string[] = []) {
  const state = useGameStore.getState();
  return saveSharedRound(remote.id, entryPayload, id, known, {
    table: state.currentTable!,
    players: state.players,
  });
}
it('requires review of another account’s new round and saves only after explicit approval', async () => {
  await publishSharedTable();
  const other = anotherPhoneAddsRound();
  const result = await saveEntry('our-stable-id');
  expect('review' in result).toBe(true);
  if (!('review' in result)) throw Error('Expected review');
  expect(result.review.rounds[0].round.id).toBe(other.id);
  expect(result.review.rounds[0].actorName).toBeTruthy();
  expect(remote.payload.rounds).toHaveLength(1);
  expect(
    mockRpc.mock.calls.filter(([, p]) => p.p_action === 'save'),
  ).toHaveLength(0);
  const saved = await saveEntry('our-stable-id', [other.id]);
  expect(saved).toHaveProperty('roundId', 'our-stable-id');
  expect(remote.payload.rounds.map((r) => r.id)).toEqual([
    other.id,
    'our-stable-id',
  ]);
  expect(remote.payload.rounds[0].gameType).toBe(
    remote.payload.rounds[1].gameType,
  );
});
it('rechecks a server version race instead of merging an unreviewed round', async () => {
  await publishSharedTable();
  const implementation = mockRpc.getMockImplementation()!;
  let injected = false;
  mockRpc.mockImplementation(async (name, params) => {
    if (params.p_action === 'save' && !injected) {
      injected = true;
      anotherPhoneAddsRound();
      return {
        data: null,
        error: { code: 'PT409', message: 'Version conflict' },
      };
    }
    return implementation(name, params);
  });
  const result = await saveEntry('race-id');
  expect(result).toHaveProperty('review');
  expect(remote.payload.rounds).toHaveLength(1);
  expect(remote.payload.rounds.some((r) => r.id === 'race-id')).toBe(false);
});
it('warns again only for additional rounds created after the first review', async () => {
  await publishSharedTable();
  const first = anotherPhoneAddsRound();
  expect(await saveEntry('review-id')).toHaveProperty('review');
  const second = anotherPhoneAddsRound();
  const result = await saveEntry('review-id', [first.id]);
  if (!('review' in result)) throw Error('Expected review');
  expect(result.review.rounds.map((r) => r.round.id)).toEqual([second.id]);
  expect(await saveEntry('review-id', [first.id, second.id])).toHaveProperty(
    'roundId',
  );
});
it('recovers an accepted save after a lost response using the same ID', async () => {
  await publishSharedTable();
  const implementation = mockRpc.getMockImplementation()!;
  let lost = false;
  mockRpc.mockImplementation(async (name, params) => {
    const result = await implementation(name, params);
    if (params.p_action === 'save' && !lost) {
      lost = true;
      return { data: null, error: { message: 'Response lost' } };
    }
    return result;
  });
  await expect(saveEntry('retry-id')).rejects.toThrow('Response lost');
  expect(remote.payload.rounds).toHaveLength(1);
  expect(await saveEntry('retry-id')).toHaveProperty('roundId', 'retry-id');
  expect(remote.payload.rounds).toHaveLength(1);
  expect(useGameStore.getState().rounds).toHaveLength(1);
});
it('keeps offline drafts outside the shared store until a fresh review on reconnect', async () => {
  await publishSharedTable();
  const implementation = mockRpc.getMockImplementation()!;
  mockRpc.mockImplementation(async () => {
    throw Error('Offline');
  });
  await expect(saveEntry('offline-id')).rejects.toThrow('Offline');
  expect(useGameStore.getState().rounds).toHaveLength(0);
  mockRpc.mockImplementation(implementation);
  anotherPhoneAddsRound();
  expect(await saveEntry('offline-id')).toHaveProperty('review');
  expect(remote.payload.rounds).toHaveLength(1);
});
it('does not warn about rounds that were known on opening or created by the same account', async () => {
  await publishSharedTable();
  const other = anotherPhoneAddsRound();
  await syncSharedTable();
  expect(await saveEntry('first-own', [other.id])).toHaveProperty('roundId');
  expect(await saveEntry('second-own', [other.id])).toHaveProperty('roundId');
  expect(remote.payload.rounds).toHaveLength(3);
});
