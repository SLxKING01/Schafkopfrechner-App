import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { FriendCommand } from '../../types/friends';
import { isFriendCommand } from '../../utils/friends';

const key = (actor: string) => `sk-friend-operation-${actor}`;
export async function readFriendOperation(
  actor: string,
): Promise<FriendCommand | null> {
  const raw =
    Platform.OS === 'web'
      ? window.sessionStorage.getItem(key(actor))
      : await SecureStore.getItemAsync(key(actor));
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!isFriendCommand(value))
    throw new Error(
      'Der gespeicherte Kontaktauftrag ist nicht lesbar. Bitte den lokalen Speicher prüfen.',
    );
  return value;
}
export async function writeFriendOperation(
  actor: string,
  command: FriendCommand,
) {
  if (Platform.OS === 'web')
    window.sessionStorage.setItem(key(actor), JSON.stringify(command));
  else await SecureStore.setItemAsync(key(actor), JSON.stringify(command));
}
export async function clearFriendOperation(actor: string, operationId: string) {
  const previous = await readFriendOperation(actor);
  if (!previous || previous.operationId !== operationId) return;
  if (Platform.OS === 'web') window.sessionStorage.removeItem(key(actor));
  else await SecureStore.deleteItemAsync(key(actor));
}
