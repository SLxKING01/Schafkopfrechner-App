import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { OwnProfile, ProfileDraft } from '../../types/profile';
import { isOwnProfile } from '../../utils/profile';

// Private fields never enter the general game backup. Web drafts live only in
// this tab; on devices they use the OS keychain, with bounded text-only values.
async function read(key: string) {
  return Platform.OS === 'web'
    ? window.sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function write(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } else if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
export async function cacheOwnProfile(profile: OwnProfile) {
  await write(`sk-profile-cache-${profile.id}`, JSON.stringify(profile));
}
export async function cachedOwnProfile(id: string): Promise<OwnProfile | null> {
  const raw = await read(`sk-profile-cache-${id}`);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  return isOwnProfile(value) && value.id === id ? value : null;
}
export async function clearProfileCache(id: string) {
  await write(`sk-profile-cache-${id}`, null);
}
export async function keepProfileDraft(id: string, draft: ProfileDraft) {
  await write(`sk-profile-draft-${id}`, JSON.stringify(draft));
}
export async function removeProfileDraft(id: string) {
  await write(`sk-profile-draft-${id}`, null);
}
export async function restoreProfileDraft(
  id: string,
): Promise<ProfileDraft | null> {
  const raw = await read(`sk-profile-draft-${id}`);
  if (!raw) return null;
  const d = JSON.parse(raw) as ProfileDraft;
  if (
    !d?.fields ||
    typeof d.fields.displayName !== 'string' ||
    typeof d.fields.firstName !== 'string' ||
    typeof d.fields.lastName !== 'string' ||
    !Number.isSafeInteger(d.version) ||
    d.version < 1 ||
    !/^[0-9a-f-]{36}$/.test(d.operationId) ||
    (d.photoUri !== undefined && typeof d.photoUri !== 'string') ||
    (d.uncertain !== undefined && typeof d.uncertain !== 'boolean')
  )
    return null;
  if (
    !(d.fields.birthDate === null || typeof d.fields.birthDate === 'string') ||
    typeof d.fields.setupCompleted !== 'boolean' ||
    !['none', 'animal', 'photo'].includes(d.fields.avatarKind) ||
    typeof d.fields.accentId !== 'string'
  )
    return null;
  // Invalid form values are retained for correction; only structural corruption is rejected.
  return d;
}
