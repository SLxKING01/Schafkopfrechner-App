import {
  executeFriendCommand,
  findFriend,
  readFriends,
} from '../services/friends/friends';
import { useAuthStore } from '../store/authStore';
import {
  refreshFriends,
  resetFriendsSession,
  runFriendCommand,
  useFriendsStore,
} from '../store/friendsStore';
import type { FriendCommand, FriendsState } from '../types/friends';
const mockRpc = jest.fn();
const mockPending = new Map<string, FriendCommand>();
const mockWrite = jest.fn(async (actor: string, c: FriendCommand) => {
  mockPending.set(actor, JSON.parse(JSON.stringify(c)));
});
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => ({ abortSignal: () => mockRpc(...args) }),
  },
}));
jest.mock('../services/friends/friendStorage', () => ({
  readFriendOperation: jest.fn(
    async (actor: string) => mockPending.get(actor) ?? null,
  ),
  writeFriendOperation: (...args: [string, FriendCommand]) =>
    mockWrite(...args),
  clearFriendOperation: jest.fn(async (actor: string, id: string) => {
    if (mockPending.get(actor)?.operationId === id) mockPending.delete(actor);
  }),
}));
const actor = '00000000-0000-4000-8000-000000000001';
const target = '00000000-0000-4000-8000-000000000002';
const initial: FriendsState = {
  userId: actor,
  version: 1,
  code: 'AAAA2222BBBB',
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
};
const command: FriendCommand = {
  action: 'send',
  targetId: target,
  expectedVersion: 0,
  referenceId: null,
  code: 'CCCC3333DDDD',
  operationId: '20000000-0000-4000-8000-000000000001',
};
beforeEach(() => {
  jest.clearAllMocks();
  mockPending.clear();
  useAuthStore.setState({ user: { id: actor } as never });
  resetFriendsSession();
  mockRpc.mockResolvedValue({ data: { ...initial }, error: null });
  mockWrite.mockImplementation(async (a, c) => {
    mockPending.set(a, JSON.parse(JSON.stringify(c)));
  });
});
it('binds all RPCs to the active account and normalizes only complete contact codes', async () => {
  expect(await readFriends(actor)).toEqual(initial);
  expect(mockRpc).toHaveBeenCalledWith('sk_friends_state', {
    p_user_id: actor,
  });
  mockRpc.mockResolvedValue({
    data: {
      ok: true,
      userId: actor,
      status: 'self',
      entry: null,
      relation: null,
    },
    error: null,
  });
  await findFriend(actor, ' aaaa-2222 bbbb ');
  expect(mockRpc).toHaveBeenLastCalledWith('sk_friends_find', {
    p_user_id: actor,
    p_code: 'AAAA2222BBBB',
  });
});
it('never applies a foreign owned list and does not call RPC after account switch', async () => {
  mockRpc.mockResolvedValue({
    data: { ...initial, userId: target },
    error: null,
  });
  await expect(readFriends(actor)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  mockRpc.mockClear();
  useAuthStore.setState({ user: { id: target } as never });
  await expect(readFriends(actor)).rejects.toMatchObject({
    code: 'ACCOUNT_CHANGED',
  });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('persists a command before sending and retains the same operation after a lost response', async () => {
  mockRpc.mockImplementation(async () => {
    expect(mockPending.get(actor)).toEqual(command);
    return { data: null, error: { message: 'Response lost' } };
  });
  await expect(executeFriendCommand(actor, command)).rejects.toMatchObject({
    mayHaveCommitted: true,
    pending: command,
  });
  expect(mockPending.get(actor)).toEqual(command);
  mockRpc.mockResolvedValue({
    data: { ok: true, state: { ...initial, version: 2 } },
    error: null,
  });
  expect(
    (await executeFriendCommand(actor, { ...mockPending.get(actor)! })).version,
  ).toBe(2);
  expect(mockPending.has(actor)).toBe(false);
  const calls = mockRpc.mock.calls.map(([, p]) => p);
  expect(calls[1]).toEqual(calls[0]);
});
it('prevents a different command from replacing an unresolved operation', async () => {
  mockPending.set(actor, command);
  await expect(
    executeFriendCommand(actor, {
      ...command,
      action: 'block',
      code: null,
      operationId: '20000000-0000-4000-8000-000000000002',
    }),
  ).rejects.toMatchObject({ code: 'PENDING', pending: command });
  expect(mockRpc).not.toHaveBeenCalled();
  expect(mockPending.get(actor)).toEqual(command);
});
it('keeps malformed save responses recoverable and clears definitively rejected stale commands', async () => {
  mockRpc.mockResolvedValueOnce({
    data: { ok: true, state: { ...initial, userId: target } },
    error: null,
  });
  await expect(executeFriendCommand(actor, command)).rejects.toMatchObject({
    mayHaveCommitted: true,
  });
  expect(mockPending.has(actor)).toBe(true);
  mockRpc.mockResolvedValueOnce({
    data: {
      ok: false,
      code: 'STALE',
      message: 'Changed',
      state: { ...initial, version: 3 },
    },
    error: null,
  });
  await expect(executeFriendCommand(actor, command)).rejects.toMatchObject({
    code: 'STALE',
    mayHaveCommitted: false,
    state: { version: 3 },
  });
  expect(mockPending.has(actor)).toBe(false);
});
it('does not send an unpersisted operation', async () => {
  mockWrite.mockRejectedValueOnce(Error('Storage failed'));
  await expect(executeFriendCommand(actor, command)).rejects.toThrow(
    'Storage failed',
  );
  expect(mockRpc).not.toHaveBeenCalled();
});
it('deduplicates only identical running commands', async () => {
  let resolve!: (value: unknown) => void;
  mockRpc.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const first = executeFriendCommand(actor, command);
  const second = executeFriendCommand(actor, { ...command });
  expect(second).toBe(first);
  await expect(
    executeFriendCommand(actor, { ...command, action: 'block', code: null }),
  ).rejects.toMatchObject({ code: 'BUSY' });
  await new Promise((r) => setTimeout(r, 0));
  resolve({ data: { ok: true, state: initial }, error: null });
  await first;
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('does not cache a delayed old-account response after switching accounts', async () => {
  let resolve!: (value: unknown) => void;
  mockRpc.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const task = refreshFriends(actor);
  await new Promise((r) => setTimeout(r, 0));
  useAuthStore.setState({ user: { id: target } as never });
  resetFriendsSession(target);
  resolve({ data: initial, error: null });
  await task;
  expect(useFriendsStore.getState().ownerId).toBe(target);
  expect(useFriendsStore.getState().state).toBeNull();
});
it('accepts the confirmed server state only after a successful mutation and keeps it on failure', async () => {
  await refreshFriends(actor);
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Offline' } });
  expect((await runFriendCommand(actor, command)).success).toBe(false);
  expect(useFriendsStore.getState().state?.version).toBe(1);
  expect(useFriendsStore.getState().pending).toEqual(command);
  mockRpc.mockResolvedValueOnce({
    data: { ok: true, state: { ...initial, version: 2 } },
    error: null,
  });
  expect((await runFriendCommand(actor, command)).success).toBe(true);
  expect(useFriendsStore.getState().state?.version).toBe(2);
  expect(useFriendsStore.getState().pending).toBeNull();
});
