import { deleteAccount } from '../services/auth/deleteAccount';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';

const actor = '00000000-0000-4000-8000-000000000001';
const calls: string[] = [];
const mockRpc = jest.fn();
const mockList = jest.fn();
const mockRemove = jest.fn();
const mockSignOut = jest.fn(async (_options?: unknown) => ({ error: null }));

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabaseConfigError: null,
  supabase: {
    rpc: (name: string) => mockRpc(name),
    storage: {
      from: () => ({
        list: (folder: string) => mockList(folder),
        remove: (paths: string[]) => mockRemove(paths),
      }),
    },
    auth: {
      signOut: (options: unknown) => mockSignOut(options),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  },
}));
jest.mock('../services/profile/profileStorage', () => ({
  clearProfileCache: jest.fn(async () => {}),
  removeProfileDraft: jest.fn(async () => {}),
  cachedOwnProfile: jest.fn(async () => null),
}));
jest.mock('../services/persistence/clearGameState', () => ({
  clearGameState: jest.fn(async () => {}),
}));

let storedPhotos: string[];

beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  storedPhotos = ['a.jpg', 'b.jpg'];
  useAuthStore.setState({
    user: { id: actor } as never,
    session: {} as never,
    isAuthenticated: true,
  });
  useGameStore.setState({
    cloudOwnerId: actor,
    tableOrderIds: ['t1'],
    activeGame: true,
  });
  mockRpc.mockImplementation(async (name: string) => {
    calls.push(name);
    if (name === 'sk_account_delete')
      return {
        data: { transferredTables: 1, deletedTables: 2 },
        error: null,
      };
    return { data: null, error: null };
  });
  mockList.mockImplementation(async () => ({
    data: storedPhotos.map((name) => ({ name })),
    error: null,
  }));
  mockRemove.mockImplementation(async (paths: string[]) => {
    calls.push('remove');
    storedPhotos = storedPhotos.filter(
      (name) => !paths.includes(`${actor}/${name}`),
    );
    return { data: [], error: null };
  });
});

test('releases and removes photos before deleting the account', async () => {
  const result = await deleteAccount();

  expect(result).toEqual({ ok: true, transferredTables: 1, deletedTables: 2 });
  expect(calls).toEqual([
    'sk_account_release_photo',
    'remove',
    'sk_account_delete',
  ]);
  expect(mockList).toHaveBeenCalledWith(actor);
  expect(mockRemove).toHaveBeenCalledWith([`${actor}/a.jpg`, `${actor}/b.jpg`]);
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useGameStore.getState().cloudOwnerId).toBeNull();
  expect(useGameStore.getState().tableOrderIds).toEqual([]);
});

test('keeps the account and session when the server refuses', async () => {
  mockRpc.mockImplementation(async (name: string) => {
    calls.push(name);
    return name === 'sk_account_delete'
      ? { data: null, error: { message: 'Profilfotos noch vorhanden' } }
      : { data: null, error: null };
  });

  const result = await deleteAccount();

  expect(result).toEqual({ ok: false, message: 'Profilfotos noch vorhanden' });
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(useGameStore.getState().cloudOwnerId).toBe(actor);
});

test('stops before deletion when photos cannot be removed', async () => {
  mockRemove.mockResolvedValue({ data: null, error: { message: 'offline' } });

  const result = await deleteAccount();

  expect(result).toEqual({ ok: false, message: 'offline' });
  expect(calls).not.toContain('sk_account_delete');
});

test('leaves local tables of another account untouched', async () => {
  useGameStore.setState({
    cloudOwnerId: 'someone-else',
    tableOrderIds: ['t1'],
  });

  await deleteAccount();

  expect(useGameStore.getState().tableOrderIds).toEqual(['t1']);
});
