import { Platform } from 'react-native';

import {
  executeInvitation,
  isInvitationState,
  listTableInvitations,
  readInvitationOperation,
} from '../services/shared/tableInvitations';
import { useAuthStore } from '../store/authStore';
import type { InvitationCommand } from '../types/tableInvitation';

const mockRpc = jest.fn();
const mockStorage = new Map<string, string>();
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => ({ abortSignal: () => mockRpc(...args) }),
  },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStorage.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStorage.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockStorage.delete(k);
  }),
}));
const actor = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const state = { userId: actor, invitations: [] };
const command: InvitationCommand = {
  action: 'send',
  id: '10000000-0000-4000-8000-000000000001',
  tableId: '20000000-0000-4000-8000-000000000001',
  recipientId: other,
  playerId: 'seat',
  role: 'read',
  version: 2,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.clear();
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  useAuthStore.setState({ user: { id: actor } as never });
  mockRpc.mockResolvedValue({ data: state, error: null });
});
it('binds listing to the active actor and rejects foreign state', async () => {
  expect(await listTableInvitations(actor)).toEqual(state);
  expect(mockRpc).toHaveBeenCalledWith('sk_table_invitations_list', {
    p_user_id: actor,
  });
  mockRpc.mockResolvedValue({ data: { ...state, userId: other }, error: null });
  await expect(listTableInvitations(actor)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  expect(
    isInvitationState({ userId: actor, invitations: [{ id: 'bad' }] }, actor),
  ).toBe(false);
});
it('writes before sending and retries the same invitation after a lost response', async () => {
  mockRpc.mockImplementation(async () => {
    expect(await readInvitationOperation(actor)).toEqual(command);
    return { data: null, error: { message: 'lost' } };
  });
  await expect(executeInvitation(actor, command)).rejects.toMatchObject({
    code: 'NETWORK',
  });
  expect(await readInvitationOperation(actor)).toEqual(command);
  await expect(
    executeInvitation(actor, {
      ...command,
      id: '10000000-0000-4000-8000-000000000002',
    }),
  ).rejects.toMatchObject({ code: 'PENDING' });
  expect(mockRpc).toHaveBeenCalledTimes(1);
  mockRpc.mockResolvedValue({ data: { ok: true, state }, error: null });
  await expect(executeInvitation(actor, command)).resolves.toEqual(state);
  expect(mockRpc).toHaveBeenLastCalledWith(
    'sk_table_invitation_command',
    expect.objectContaining({
      p_id: command.id,
      p_action: 'send',
      p_user_id: actor,
      p_player_id: 'seat',
      p_role: 'read',
      p_version: 2,
    }),
  );
  expect(await readInvitationOperation(actor)).toBeNull();
});
it('retains ambiguous replies but clears a definitive stale invitation', async () => {
  mockRpc.mockResolvedValue({
    data: { ok: true, state: { userId: other, invitations: [] } },
    error: null,
  });
  await expect(executeInvitation(actor, command)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  expect(await readInvitationOperation(actor)).toEqual(command);
  mockRpc.mockResolvedValue({
    data: { ok: false, code: 'STALE', message: 'Erledigt', state },
    error: null,
  });
  await expect(executeInvitation(actor, command)).rejects.toMatchObject({
    code: 'STALE',
    state,
  });
  expect(await readInvitationOperation(actor)).toBeNull();
});
it('never sends after failed storage and never overwrites a corrupt pending operation', async () => {
  mockStorage.set(`sk-table-invitation-${actor}`, 'broken');
  await expect(executeInvitation(actor, command)).rejects.toThrow();
  expect(mockRpc).not.toHaveBeenCalled();
});
it('deduplicates identical in-flight operations and rejects different ones', async () => {
  let finish!: (v: unknown) => void;
  mockRpc.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const one = executeInvitation(actor, command);
  const two = executeInvitation(actor, { ...command });
  expect(one).toBe(two);
  await expect(
    executeInvitation(actor, { action: 'cancel', id: command.id }),
  ).rejects.toMatchObject({ code: 'BUSY' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  finish({ data: { ok: true, state }, error: null });
  await one;
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('ignores late responses after account switch and retains recovery for the original account', async () => {
  mockRpc.mockImplementation(async () => {
    useAuthStore.setState({ user: { id: other } as never });
    return { data: { ok: true, state }, error: null };
  });
  await expect(executeInvitation(actor, command)).rejects.toMatchObject({
    code: 'ACCOUNT_CHANGED',
  });
  expect(await readInvitationOperation(actor)).toEqual(command);
  mockRpc.mockClear();
  await expect(listTableInvitations(actor)).rejects.toMatchObject({
    code: 'ACCOUNT_CHANGED',
  });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('rejects malformed commands before storage or network access', async () => {
  await expect(
    executeInvitation(actor, { ...command, role: 'owner' } as never),
  ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
  expect(mockStorage.size).toBe(0);
  expect(mockRpc).not.toHaveBeenCalled();
});
