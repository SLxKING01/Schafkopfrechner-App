import type {
  FriendCommand,
  FriendEntry,
  FriendSearch,
  FriendsState,
} from '../types/friends';
import { isProfileCard } from './profile';

export const friendActions = [
  'send',
  'accept',
  'decline',
  'cancel',
  'remove',
  'block',
  'unblock',
] as const;
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function normalizeFriendCode(value: string) {
  return value.replace(/[\s-]/g, '').toUpperCase();
}
export function validFriendCode(value: string) {
  return /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/.test(
    normalizeFriendCode(value),
  );
}
export function formatFriendCode(value: string) {
  return (
    normalizeFriendCode(value)
      .match(/.{1,4}/g)
      ?.join('-') ?? ''
  );
}
export function isFriendEntry(value: unknown): value is FriendEntry {
  if (!value || typeof value !== 'object') return false;
  const row = value as FriendEntry;
  return (
    isUuid(row.profile?.id) &&
    isProfileCard(row.profile) &&
    Number.isSafeInteger(row.pairVersion) &&
    row.pairVersion >= 0 &&
    (row.requestId === null || isUuid(row.requestId)) &&
    (row.blockId === null || isUuid(row.blockId))
  );
}
export function isFriendsState(value: unknown): value is FriendsState {
  if (!value || typeof value !== 'object') return false;
  const s = value as FriendsState;
  if (
    !isUuid(s.userId) ||
    !Number.isSafeInteger(s.version) ||
    s.version < 1 ||
    typeof s.code !== 'string' ||
    !validFriendCode(s.code)
  )
    return false;
  const seen = new Set<string>();
  return (
    [s.friends, s.incoming, s.outgoing, s.blocked].every(
      (rows) =>
        Array.isArray(rows) &&
        rows.every((row) => {
          if (
            !isFriendEntry(row) ||
            row.profile.id === s.userId ||
            seen.has(row.profile.id)
          )
            return false;
          seen.add(row.profile.id);
          return true;
        }),
    ) &&
    [...s.incoming, ...s.outgoing].every((row) => row.requestId !== null) &&
    s.blocked.every((row) => row.blockId !== null)
  );
}
export function isFriendSearch(value: unknown): value is FriendSearch {
  if (!value || typeof value !== 'object') return false;
  const result = value as FriendSearch;
  if (
    !isUuid(result.userId) ||
    !['found', 'not_found', 'invalid', 'self'].includes(result.status)
  )
    return false;
  return result.status === 'found'
    ? isFriendEntry(result.entry) &&
        ['none', 'incoming', 'outgoing', 'friend'].includes(
          result.relation ?? '',
        ) &&
        result.entry.profile.id !== result.userId
    : result.entry === null && result.relation === null;
}
export function isFriendCommand(value: unknown): value is FriendCommand {
  if (!value || typeof value !== 'object') return false;
  const c = value as FriendCommand;
  return (
    friendActions.includes(c.action) &&
    isUuid(c.targetId) &&
    isUuid(c.operationId) &&
    Number.isSafeInteger(c.expectedVersion) &&
    c.expectedVersion >= 0 &&
    (c.referenceId === null || isUuid(c.referenceId)) &&
    (c.code === null ||
      (typeof c.code === 'string' && validFriendCode(c.code))) &&
    (c.action !== 'send' || c.code !== null)
  );
}

export function friendCommandKey(command: FriendCommand) {
  return JSON.stringify([
    command.action,
    command.targetId,
    command.expectedVersion,
    command.referenceId,
    command.code,
    command.operationId,
  ]);
}
