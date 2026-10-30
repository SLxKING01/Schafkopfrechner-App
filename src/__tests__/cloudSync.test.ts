import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  captureGameState,
  fingerprint,
  getSyncConflict,
  recoverPendingSyncRestore,
  resolveSyncConflict,
  syncGameState,
} from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import type { AuthUser } from '../types/auth';

const mockRead = jest.fn();
const mockRpc = jest.fn();
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => mockRead() }) }),
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const user = { id: 'owner-a' } as AuthUser;

async function conflictFixture() {
  const before = captureGameState();
  useGameStore.setState({
    cloudOwnerId: user.id,
    cloudVersion: 1,
    cloudBaseline: fingerprint(before),
  });
  usePlayerStore.setState({ players: [{ id: 'local', name: 'Gerät' }] });
  const remote = { ...before, savedPlayers: [{ id: 'remote', name: 'Cloud' }] };
  mockRead.mockResolvedValue({
    data: { payload: remote, version: 2, updated_at: '2026-10-27T10:00:00Z' },
    error: null,
  });
  await syncGameState();
  return { expected: getSyncConflict()!, remote, local: captureGameState() };
}
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user });
  useGameStore.setState({
    archivedGameDays: [],
    currentTable: null,
    players: [],
    rounds: [],
    settlements: [],
    balances: [],
    games: [],
    activeGame: false,
    tableOrderIds: [],
    syncing: false,
    cloudOwnerId: null,
    cloudVersion: null,
    cloudBaseline: null,
    lastSyncedAt: null,
    syncError: null,
    isOffline: false,
  });
  usePlayerStore.setState({ players: [] });
  useMatchDayStore.setState({ matchDays: [], activeMatchDayId: null });
  mockRead.mockResolvedValue({ data: null, error: null });
  mockRpc.mockResolvedValue({
    data: [{ version: 1, updated_at: '2026-10-23T12:00:00Z' }],
    error: null,
  });
});

it.each(['local', 'remote'] as const)(
  'backs up both conflict versions before explicitly choosing %s',
  async (choice) => {
    const { expected, local, remote } = await conflictFixture();
    expect(expected).not.toBeNull();
    await resolveSyncConflict(choice, expected);
    const backup = JSON.parse(
      (await AsyncStorage.getItem('schafkopfrechner-sync-conflict-backup'))!,
    );
    expect(backup.local).toEqual(local);
    expect(backup.remote).toEqual(remote);
    expect(backup.ownerId).toBe(user.id);
    expect(getSyncConflict()).toBeNull();
    expect(usePlayerStore.getState().players[0].id).toBe(
      choice === 'local' ? 'local' : 'remote',
    );
    if (choice === 'local')
      expect(mockRpc).toHaveBeenCalledWith('save_game_state', {
        p_payload: local,
        p_expected_version: 2,
      });
    else {
      expect(mockRpc).not.toHaveBeenCalled();
      expect(
        JSON.parse(
          (await AsyncStorage.getItem('schafkopfrechner-sync-restore'))!,
        ).phase,
      ).toBe('complete');
    }
  },
);

it('requires another comparison if either version changed while the conflict was displayed', async () => {
  const { expected, remote } = await conflictFixture();
  mockRead.mockResolvedValue({
    data: { payload: remote, version: 3, updated_at: 'new' },
    error: null,
  });
  await expect(resolveSyncConflict('local', expected)).rejects.toThrow(
    'erneut vergleichen',
  );
  expect(mockRpc).not.toHaveBeenCalled();
  expect(getSyncConflict()?.remoteVersion).toBe(3);
  useAuthStore.setState({ user: null });
  await expect(
    resolveSyncConflict('remote', getSyncConflict()!),
  ).rejects.toThrow('Konto');
  expect(usePlayerStore.getState().players[0].id).toBe('local');
});

it('resumes an interrupted multi-store restore from its confirmed recovery journal', async () => {
  const { expected, local, remote } = await conflictFixture();
  await reliableStorage.flush();
  const implementation = jest
    .mocked(AsyncStorage.setItem)
    .getMockImplementation()!;
  const failure = jest
    .spyOn(AsyncStorage, 'setItem')
    .mockImplementation(async (key, value) => {
      if (key === 'schafkopfrechner-games') throw new Error('Disk full');
      return implementation(key, value);
    });
  await expect(resolveSyncConflict('remote', expected)).rejects.toThrow(
    'Wiederherstellung',
  );
  expect(
    JSON.parse((await AsyncStorage.getItem('schafkopfrechner-sync-restore'))!)
      .phase,
  ).toBe('pending');
  failure.mockImplementation(implementation);
  // Emulate a restart with game data from before and player data already restored.
  useGameStore.setState({ games: local.games });
  usePlayerStore.setState({ players: remote.savedPlayers });
  await recoverPendingSyncRestore();
  expect(usePlayerStore.getState().players).toEqual(remote.savedPlayers);
  expect(
    JSON.parse((await AsyncStorage.getItem('schafkopfrechner-sync-restore'))!)
      .phase,
  ).toBe('complete');
  expect(await reliableStorage.confirmWrite('schafkopfrechner-games')).toBe(
    true,
  );
});

it('does not overwrite a new local edit made while the restore journal is being saved', async () => {
  const original = captureGameState();
  useGameStore.setState({
    cloudOwnerId: user.id,
    cloudVersion: 1,
    cloudBaseline: fingerprint(original),
  });
  const remote = {
    ...original,
    savedPlayers: [{ id: 'remote', name: 'Cloud' }],
  };
  mockRead.mockResolvedValue({
    data: { payload: remote, version: 2, updated_at: 'now' },
    error: null,
  });
  const implementation = jest
    .mocked(AsyncStorage.setItem)
    .getMockImplementation()!;
  let edited = false;
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    await implementation(key, value);
    if (
      !edited &&
      key === 'schafkopfrechner-sync-restore' &&
      JSON.parse(value).phase === 'pending'
    ) {
      edited = true;
      usePlayerStore.setState({
        players: [{ id: 'late', name: 'Neu eingetragen' }],
      });
    }
  });
  try {
    await syncGameState();
    expect(usePlayerStore.getState().players[0].id).toBe('late');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(useGameStore.getState().syncError).toContain(
      'während der Sicherung geändert',
    );
  } finally {
    jest.mocked(AsyncStorage.setItem).mockImplementation(implementation);
  }
});

it('uploads all stores atomically, including settlement payment state and game history', async () => {
  seedArchive();
  usePlayerStore.setState({
    players: [
      { id: 'a', name: 'Anna' },
      { id: 'b', name: 'Max' },
    ],
  });
  useMatchDayStore.setState({
    matchDays: [
      {
        id: 'day',
        name: 'Heute',
        createdAt: 'now',
        isActive: true,
        isClosed: false,
      },
    ],
    activeMatchDayId: 'day',
  });
  useGameStore.setState({
    games: [
      {
        id: 'game-1',
        winnerId: 'a',
        loserIds: ['b'],
        amount: 1.23,
        createdAt: 'now',
      },
    ],
  });
  const snapshot = captureGameState();
  await syncGameState();
  expect(mockRpc).toHaveBeenCalledWith('save_game_state', {
    p_payload: snapshot,
    p_expected_version: 0,
  });
  expect(useGameStore.getState()).toMatchObject({
    cloudOwnerId: user.id,
    cloudVersion: 1,
    isOffline: false,
    syncing: false,
  });
});

it('restores the cloud on an empty new device instead of uploading empty data', async () => {
  const snapshot = {
    ...captureGameState(),
    savedPlayers: [{ id: 'remote-player', name: 'Anna' }],
  };
  mockRead.mockResolvedValue({
    data: { payload: snapshot, version: 4, updated_at: 'now' },
    error: null,
  });
  await syncGameState();
  expect(usePlayerStore.getState().players).toEqual(snapshot.savedPlayers);
  expect(useGameStore.getState().cloudVersion).toBe(4);
  expect(mockRpc).not.toHaveBeenCalled();
});

it('pulls another device changes when local state is clean without creating an upload loop', async () => {
  useGameStore.setState({
    cloudOwnerId: user.id,
    cloudVersion: 1,
    cloudBaseline: fingerprint(captureGameState()),
  });
  const snapshot = {
    ...captureGameState(),
    savedPlayers: [{ id: 'p', name: 'Max' }],
  };
  mockRead.mockResolvedValue({
    data: { payload: snapshot, version: 2, updated_at: 'now' },
    error: null,
  });
  await syncGameState();
  await syncGameState();
  expect(usePlayerStore.getState().players).toEqual(snapshot.savedPlayers);
  expect(mockRpc).not.toHaveBeenCalled();
});

it('sends deletions and edits as a new complete snapshot with a version precondition', async () => {
  const previous = captureGameState();
  useGameStore.setState({
    cloudOwnerId: user.id,
    cloudVersion: 3,
    cloudBaseline: fingerprint(previous),
  });
  usePlayerStore.setState({ players: [{ id: 'p', name: 'Changed' }] });
  mockRead.mockResolvedValue({
    data: { payload: previous, version: 3, updated_at: 'before' },
    error: null,
  });
  await syncGameState();
  expect(mockRpc).toHaveBeenCalledWith('save_game_state', {
    p_payload: captureGameState(),
    p_expected_version: 3,
  });
});

it('preserves local data and timestamp after a failed upload and can retry', async () => {
  usePlayerStore.setState({ players: [{ id: 'p', name: 'Offline' }] });
  mockRpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'Network error' },
  });
  await syncGameState();
  expect(useGameStore.getState()).toMatchObject({
    isOffline: true,
    syncing: false,
    lastSyncedAt: null,
    syncError: 'Network error',
  });
  expect(usePlayerStore.getState().players).toHaveLength(1);
  await syncGameState();
  expect(useGameStore.getState()).toMatchObject({
    cloudVersion: 1,
    isOffline: false,
    syncError: null,
  });
});

it('refuses to overwrite independently changed cloud data', async () => {
  const original = captureGameState();
  useGameStore.setState({
    cloudOwnerId: user.id,
    cloudVersion: 1,
    cloudBaseline: fingerprint(original),
  });
  usePlayerStore.setState({ players: [{ id: 'local', name: 'Local' }] });
  mockRead.mockResolvedValue({
    data: {
      payload: {
        ...original,
        savedPlayers: [{ id: 'remote', name: 'Remote' }],
      },
      version: 2,
    },
    error: null,
  });
  await syncGameState();
  expect(useGameStore.getState().syncError).toContain(
    'Synchronisierungskonflikt',
  );
  expect(usePlayerStore.getState().players[0].id).toBe('local');
  expect(mockRpc).not.toHaveBeenCalled();
});

it('never uploads data to another account or while signed out', async () => {
  useGameStore.setState({ cloudOwnerId: 'different-owner' });
  await syncGameState();
  expect(mockRead).not.toHaveBeenCalled();
  useAuthStore.setState({ user: null });
  await syncGameState();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('deduplicates concurrent sync requests', async () => {
  await Promise.all([syncGameState(), syncGameState(), syncGameState()]);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('ignores results if the account changed while fetching', async () => {
  mockRead.mockImplementationOnce(async () => {
    useAuthStore.setState({ user: null });
    return { data: null, error: null };
  });
  await syncGameState();
  expect(mockRpc).not.toHaveBeenCalled();
  expect(useGameStore.getState().syncing).toBe(false);
});

it('compares JSONB snapshots independently of object key order', () => {
  expect(fingerprint({ b: 2, a: { x: 1, y: 2 } })).toBe(
    fingerprint({ a: { y: 2, x: 1 }, b: 2 }),
  );
});

it('keeps changes made during an upload pending for the next sync', async () => {
  mockRpc.mockImplementationOnce(async () => {
    usePlayerStore.setState({
      players: [{ id: 'new', name: 'Added during upload' }],
    });
    return { data: [{ version: 1, updated_at: 'now' }], error: null };
  });
  await syncGameState();
  expect(useGameStore.getState().isOffline).toBe(true);
  expect(useGameStore.getState().cloudBaseline).not.toBe(
    fingerprint(captureGameState()),
  );
});

it('does not overwrite a first-time cloud backup when this device already has local games', async () => {
  const remote = captureGameState();
  usePlayerStore.setState({ players: [{ id: 'local', name: 'Keep me' }] });
  mockRead.mockResolvedValue({
    data: { payload: remote, version: 1 },
    error: null,
  });
  await syncGameState();
  expect(useGameStore.getState().syncError).toContain(
    'Synchronisierungskonflikt',
  );
  expect(mockRpc).not.toHaveBeenCalled();
  expect(usePlayerStore.getState().players[0].name).toBe('Keep me');
});

it('preserves local data on invalid cloud data and failed reads', async () => {
  mockRead.mockResolvedValueOnce({
    data: { payload: { schemaVersion: 99 }, version: 1 },
    error: null,
  });
  await syncGameState();
  expect(useGameStore.getState().syncError).toContain('unbekanntes Format');
  mockRead.mockResolvedValueOnce({
    data: null,
    error: { message: 'Read failed' },
  });
  await syncGameState();
  expect(useGameStore.getState().syncError).toBe('Read failed');
  expect(mockRpc).not.toHaveBeenCalled();
});

function seedArchive() {
  useGameStore.getState().createTable('Archivabend', [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Max', isLocal: true },
  ]);
  useGameStore.getState().addRound({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 10,
    gameType: 'rufspiel',
  });
  useGameStore.getState().finishGameDay();
  const payment = useGameStore.getState().settlements[0];
  useGameStore.getState().markSettlementPaid(payment.id);
  return useGameStore.getState().archivedGameDays[0];
}

it('uploads and restores archive history including paid payments on a new device', async () => {
  const archived = seedArchive();
  useGameStore.getState().createTable('Neuer Tisch', [
    { id: 'c', name: 'Chris', isLocal: true },
    { id: 'd', name: 'Dani', isLocal: true },
  ]);
  const snapshot = captureGameState();
  await syncGameState();
  expect(mockRpc.mock.calls[0][1].p_payload.archivedGameDays).toEqual([
    archived,
  ]);
  useGameStore.setState({
    archivedGameDays: [],
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
    cloudOwnerId: null,
    cloudVersion: null,
    cloudBaseline: null,
  });
  mockRead.mockResolvedValue({
    data: { payload: snapshot, version: 2, updated_at: 'now' },
    error: null,
  });
  await syncGameState();
  expect(useGameStore.getState().archivedGameDays).toEqual([archived]);
  expect(useGameStore.getState().currentTable?.name).toBe('Neuer Tisch');
});

it('retains history if an older client cloud snapshot omits the archive field', async () => {
  const archived = seedArchive();
  useGameStore.getState().resetGame();
  useGameStore.setState({
    cloudOwnerId: user.id,
    cloudVersion: 1,
    cloudBaseline: fingerprint(captureGameState()),
  });
  const legacy = { ...captureGameState(), archivedGameDays: undefined };
  mockRead.mockResolvedValue({
    data: { payload: legacy, version: 2, updated_at: 'now' },
    error: null,
  });
  await syncGameState();
  expect(useGameStore.getState().archivedGameDays).toEqual([archived]);
  await syncGameState();
  expect(mockRpc).toHaveBeenCalledWith('save_game_state', {
    p_payload: expect.objectContaining({ archivedGameDays: [archived] }),
    p_expected_version: 2,
  });
});

it('does not treat an archive-only local device as empty on first synchronization', async () => {
  const emptyRemote = captureGameState();
  const archived = seedArchive();
  useGameStore.getState().resetGame();
  mockRead.mockResolvedValue({
    data: { payload: emptyRemote, version: 1, updated_at: 'now' },
    error: null,
  });
  await syncGameState();
  expect(useGameStore.getState().syncError).toContain(
    'Synchronisierungskonflikt',
  );
  expect(useGameStore.getState().archivedGameDays).toEqual([archived]);
  expect(mockRpc).not.toHaveBeenCalled();
});

it.each([
  [
    'unknown round participant',
    (s: ReturnType<typeof captureGameState>) => {
      s.rounds[0].winnerId = 'unknown';
    },
  ],
  [
    'wrong table reference',
    (s: ReturnType<typeof captureGameState>) => {
      s.rounds[0].tableId = 'other';
    },
  ],
  [
    'wrong cached balance',
    (s: ReturnType<typeof captureGameState>) => {
      s.balances[0].amount = 99;
    },
  ],
  [
    'wrong payment amount',
    (s: ReturnType<typeof captureGameState>) => {
      s.settlements[0].amount = 99;
    },
  ],
  [
    'duplicate roster',
    (s: ReturnType<typeof captureGameState>) => {
      s.players.push(s.players[0]);
    },
  ],
] as const)(
  'rejects cloud corruption: %s without changing local history',
  async (_label, corrupt) => {
    seedArchive();
    const original = captureGameState();
    const remote = JSON.parse(JSON.stringify(original)) as typeof original;
    corrupt(remote);
    mockRead.mockResolvedValue({
      data: { payload: remote, version: 2, updated_at: 'now' },
      error: null,
    });
    await syncGameState();
    expect(useGameStore.getState().syncError).toContain('unbekanntes Format');
    expect(captureGameState()).toEqual(original);
    expect(mockRpc).not.toHaveBeenCalled();
  },
);
