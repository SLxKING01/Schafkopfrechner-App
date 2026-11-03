import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import type {
  InvitationCommand,
  InvitationState,
} from '../../types/tableInvitation';
import { isProfileCard } from '../../utils/profile';

const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function isInvitationCommand(v: unknown): v is InvitationCommand {
  if (!v || typeof v !== 'object') return false;
  const c = v as InvitationCommand;
  return (
    uuid(c.id) &&
    ['send', 'accept', 'decline', 'cancel'].includes(c.action) &&
    (c.action !== 'send' ||
      (uuid(c.tableId) &&
        uuid(c.recipientId) &&
        typeof c.playerId === 'string' &&
        c.playerId.length > 0 &&
        c.playerId.length <= 100 &&
        ['read', 'write'].includes(c.role ?? '') &&
        Number.isSafeInteger(c.version) &&
        c.version! > 0))
  );
}
export function isInvitationState(
  v: unknown,
  actor: string,
): v is InvitationState {
  if (!v || typeof v !== 'object') return false;
  const s = v as InvitationState;
  return (
    s.userId === actor &&
    Array.isArray(s.invitations) &&
    new Set(s.invitations.map((i) => i?.id)).size === s.invitations.length &&
    s.invitations.every(
      (i) =>
        i &&
        uuid(i.id) &&
        uuid(i.tableId) &&
        typeof i.tableName === 'string' &&
        typeof i.playerId === 'string' &&
        typeof i.playerName === 'string' &&
        uuid(i.sender?.id) &&
        uuid(i.recipient?.id) &&
        isProfileCard(i.sender) &&
        isProfileCard(i.recipient) &&
        i.sender.id !== i.recipient.id &&
        [i.sender.id, i.recipient.id].includes(actor) &&
        ['read', 'write'].includes(i.role) &&
        typeof i.available === 'boolean' &&
        Number.isFinite(Date.parse(i.createdAt)) &&
        Number.isFinite(Date.parse(i.expiresAt)),
    )
  );
}
export class InvitationError extends Error {
  constructor(
    message: string,
    public code: string,
    public state?: InvitationState,
  ) {
    super(message);
  }
}
function assertActor(actor: string) {
  if (useAuthStore.getState().user?.id !== actor)
    throw new InvitationError(
      'Das Konto hat sich geändert. Bitte erneut öffnen.',
      'ACCOUNT_CHANGED',
    );
}
const key = (actor: string) => `sk-table-invitation-${actor}`;
export async function readInvitationOperation(
  actor: string,
): Promise<InvitationCommand | null> {
  const raw =
    Platform.OS === 'web'
      ? window.sessionStorage.getItem(key(actor))
      : await SecureStore.getItemAsync(key(actor));
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!isInvitationCommand(value))
    throw new InvitationError(
      'Der gespeicherte Einladungsauftrag konnte nicht gelesen werden.',
      'STORAGE',
    );
  return value;
}
async function writeOperation(
  actor: string,
  command: InvitationCommand | null,
) {
  if (Platform.OS === 'web') {
    if (command)
      window.sessionStorage.setItem(key(actor), JSON.stringify(command));
    else window.sessionStorage.removeItem(key(actor));
  } else if (command)
    await SecureStore.setItemAsync(key(actor), JSON.stringify(command));
  else await SecureStore.deleteItemAsync(key(actor));
}
async function rpc(
  actor: string,
  name: string,
  params: Record<string, unknown>,
) {
  assertActor(actor);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const { data, error } = await supabase
      .rpc(name, { ...params, p_user_id: actor })
      .abortSignal(controller.signal);
    assertActor(actor);
    if (error)
      throw new InvitationError(
        error.code
          ? error.message
          : 'Keine Verbindung. Bitte erneut versuchen.',
        error.code || 'NETWORK',
      );
    return data;
  } catch (e) {
    if (e instanceof InvitationError) throw e;
    throw new InvitationError(
      'Keine Verbindung. Bitte erneut versuchen.',
      'NETWORK',
    );
  } finally {
    clearTimeout(timeout);
  }
}
export async function listTableInvitations(
  actor: string,
): Promise<InvitationState> {
  const data: unknown = await rpc(actor, 'sk_table_invitations_list', {});
  if (!isInvitationState(data, actor))
    throw new InvitationError(
      'Ungültige Antwort für die Einladungen.',
      'INVALID_RESPONSE',
    );
  return data;
}
const running = new Map<
  string,
  { signature: string; task: Promise<InvitationState> }
>();
export function executeInvitation(
  actor: string,
  command: InvitationCommand,
): Promise<InvitationState> {
  if (!isInvitationCommand(command))
    return Promise.reject(
      new InvitationError('Ungültiger Einladungsauftrag.', 'INVALID_COMMAND'),
    );
  const signature = JSON.stringify(command);
  const previous = running.get(actor);
  if (previous)
    return previous.signature === signature
      ? previous.task
      : Promise.reject(
          new InvitationError('Ein Auftrag wird noch geprüft.', 'BUSY'),
        );
  const task = execute(actor, command).finally(() => {
    if (running.get(actor)?.task === task) running.delete(actor);
  });
  running.set(actor, { signature, task });
  return task;
}
async function execute(
  actor: string,
  c: InvitationCommand,
): Promise<InvitationState> {
  assertActor(actor);
  const pending = await readInvitationOperation(actor);
  assertActor(actor);
  if (pending && JSON.stringify(pending) !== JSON.stringify(c))
    throw new InvitationError(
      'Bitte zuerst den gespeicherten Auftrag prüfen.',
      'PENDING',
    );
  await writeOperation(actor, c);
  assertActor(actor);
  try {
    const data = await rpc(actor, 'sk_table_invitation_command', {
      p_action: c.action,
      p_id: c.id,
      p_table_id: c.tableId ?? null,
      p_recipient: c.recipientId ?? null,
      p_player_id: c.playerId ?? null,
      p_role: c.role ?? null,
      p_version: c.version ?? null,
    });
    if (!isInvitationState(data?.state, actor) || typeof data?.ok !== 'boolean')
      throw new InvitationError(
        'Die Antwort ist unklar. Bitte denselben Auftrag erneut prüfen.',
        'INVALID_RESPONSE',
      );
    await writeOperation(actor, null);
    assertActor(actor);
    if (!data.ok)
      throw new InvitationError(
        data.message ?? 'Einladung konnte nicht geändert werden.',
        data.code ?? 'UNAVAILABLE',
        data.state,
      );
    return data.state;
  } catch (e) {
    if (e instanceof InvitationError && ['42501', '22023'].includes(e.code))
      await writeOperation(actor, null);
    throw e;
  }
}
