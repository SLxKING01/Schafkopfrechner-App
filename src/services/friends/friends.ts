import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import type {
  FriendCommand,
  FriendSearch,
  FriendsState,
} from '../../types/friends';
import {
  friendCommandKey,
  isFriendCommand,
  isFriendSearch,
  isFriendsState,
  normalizeFriendCode,
} from '../../utils/friends';
import {
  clearFriendOperation,
  readFriendOperation,
  writeFriendOperation,
} from './friendStorage';

export class FriendError extends Error {
  constructor(
    message: string,
    public code: string,
    public mayHaveCommitted = false,
    public state?: FriendsState,
    public pending?: FriendCommand,
  ) {
    super(message);
  }
}
export function assertFriendActor(actor: string) {
  if (useAuthStore.getState().user?.id !== actor)
    throw new FriendError(
      'Das Konto hat sich geändert. Bitte die Freunde-Ansicht erneut öffnen.',
      'ACCOUNT_CHANGED',
    );
}
async function rpc(
  actor: string,
  name: string,
  params: Record<string, unknown>,
) {
  assertFriendActor(actor);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const { data, error } = await supabase
      .rpc(name, { ...params, p_user_id: actor })
      .abortSignal(controller.signal);
    assertFriendActor(actor);
    if (error)
      throw new FriendError(
        error.code
          ? error.message
          : 'Die Verbindung konnte nicht hergestellt werden. Bitte erneut versuchen.',
        error.code || 'NETWORK',
      );
    return data;
  } catch (reason) {
    if (reason instanceof FriendError) throw reason;
    throw new FriendError(
      'Die Verbindung konnte nicht hergestellt werden. Bitte erneut versuchen.',
      'NETWORK',
    );
  } finally {
    clearTimeout(timeout);
  }
}
export async function readFriends(actor: string): Promise<FriendsState> {
  const data: unknown = await rpc(actor, 'sk_friends_state', {});
  if (!isFriendsState(data) || data.userId !== actor)
    throw new FriendError(
      'Ungültige Antwort für die Freundesliste.',
      'INVALID_RESPONSE',
    );
  return data;
}
export async function findFriend(
  actor: string,
  code: string,
): Promise<FriendSearch> {
  const data = await rpc(actor, 'sk_friends_find', {
    p_code: normalizeFriendCode(code),
  });
  if (data?.ok === false)
    throw new FriendError(
      data.message ?? 'Die Suche konnte nicht abgeschlossen werden.',
      data.code ?? 'SEARCH_FAILED',
    );
  if (!isFriendSearch(data) || data.userId !== actor)
    throw new FriendError(
      'Ungültige Antwort für die Freundessuche.',
      'INVALID_RESPONSE',
    );
  return data;
}
const running = new Map<
  string,
  { key: string; promise: Promise<FriendsState> }
>();
export function executeFriendCommand(
  actor: string,
  command: FriendCommand,
): Promise<FriendsState> {
  if (!isFriendCommand(command))
    return Promise.reject(
      new FriendError('Ungültiger Kontaktauftrag.', 'INVALID_COMMAND'),
    );
  command = {
    ...command,
    code: command.code ? normalizeFriendCode(command.code) : null,
  };
  const key = friendCommandKey(command);
  const current = running.get(actor);
  if (current) {
    if (current.key === key) return current.promise;
    return Promise.reject(
      new FriendError('Ein anderer Kontaktauftrag wird noch geprüft.', 'BUSY'),
    );
  }
  const promise = execute(actor, command).finally(() => {
    if (running.get(actor)?.promise === promise) running.delete(actor);
  });
  running.set(actor, { key, promise });
  return promise;
}
async function execute(
  actor: string,
  command: FriendCommand,
): Promise<FriendsState> {
  assertFriendActor(actor);
  if (!isFriendCommand(command) || command.targetId === actor)
    throw new FriendError('Ungültiger Kontaktauftrag.', 'INVALID_COMMAND');
  const previous = await readFriendOperation(actor);
  assertFriendActor(actor);
  if (previous && friendCommandKey(previous) !== friendCommandKey(command))
    throw new FriendError(
      'Bitte zuerst den ausstehenden Kontaktauftrag prüfen.',
      'PENDING',
      true,
      undefined,
      previous,
    );
  await writeFriendOperation(actor, command);
  assertFriendActor(actor);
  let mayHaveCommitted = true;
  try {
    const data = await rpc(actor, 'sk_friends_command', {
      p_action: command.action,
      p_target: command.targetId,
      p_expected_version: command.expectedVersion,
      p_reference: command.referenceId,
      p_code: command.code,
      p_operation_id: command.operationId,
    });
    const state =
      isFriendsState(data?.state) && data.state.userId === actor
        ? data.state
        : undefined;
    if (data?.ok === false) {
      mayHaveCommitted = false;
      await clearFriendOperation(actor, command.operationId);
      throw new FriendError(
        data.message ?? 'Der Kontaktauftrag konnte nicht ausgeführt werden.',
        data.code ?? 'ACTION_FAILED',
        false,
        state,
      );
    }
    if (data?.ok !== true || !state)
      throw new FriendError(
        'Die Speicherantwort ist unklar. Bitte denselben Auftrag erneut prüfen.',
        'INVALID_RESPONSE',
        true,
      );
    await clearFriendOperation(actor, command.operationId);
    assertFriendActor(actor);
    return state;
  } catch (reason) {
    const error =
      reason instanceof FriendError
        ? reason
        : new FriendError(
            reason instanceof Error
              ? reason.message
              : 'Kontaktauftrag fehlgeschlagen.',
            'NETWORK',
          );
    if (['42501', '22023', 'INVALID_COMMAND'].includes(error.code)) {
      mayHaveCommitted = false;
      await clearFriendOperation(actor, command.operationId).catch(() => {});
    }
    error.mayHaveCommitted = error.mayHaveCommitted || mayHaveCommitted;
    error.pending = error.mayHaveCommitted ? command : undefined;
    throw error;
  }
}
