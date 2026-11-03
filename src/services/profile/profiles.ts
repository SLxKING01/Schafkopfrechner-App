import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import type {
  OwnProfile,
  ProfileCard,
  ProfileDraft,
} from '../../types/profile';
import {
  isOwnProfile,
  isProfileCard,
  validateProfile,
} from '../../utils/profile';
import { profilePhotoBytes } from './profilePhoto';
import { cacheOwnProfile, keepProfileDraft } from './profileStorage';

const bucket = 'profile-photos';
export function assertProfileActor(actor: string) {
  if (useAuthStore.getState().user?.id !== actor)
    throw new Error(
      'Das Konto hat sich geändert. Bitte das Profil erneut öffnen.',
    );
}
async function rpc(name: string, params: Record<string, unknown> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const { data, error } = await supabase
      .rpc(name, params)
      .abortSignal(controller.signal);
    if (error)
      throw Object.assign(new Error(error.message), { code: error.code });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
export async function readOwnProfile(actor: string): Promise<OwnProfile> {
  assertProfileActor(actor);
  const data: unknown = await rpc('sk_profile_own');
  assertProfileActor(actor);
  if (!isOwnProfile(data) || data.id !== actor)
    throw new Error('Ungültige Profilantwort. Bitte erneut versuchen.');
  await cacheOwnProfile(data).catch(() => {});
  return data;
}
export async function readProfileCards(
  actor: string,
  ids: string[],
): Promise<ProfileCard[]> {
  assertProfileActor(actor);
  const data: unknown = await rpc('sk_profile_cards', {
    p_ids: [...new Set(ids)].slice(0, 60),
  });
  assertProfileActor(actor);
  if (!Array.isArray(data) || !data.every(isProfileCard))
    throw new Error('Profile konnten nicht geladen werden.');
  return data;
}
export async function profilePhotoUrl(actor: string, path: string) {
  assertProfileActor(actor);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 300);
  assertProfileActor(actor);
  if (error) throw error;
  return data.signedUrl;
}

export async function saveOwnProfile(
  actor: string,
  draft: ProfileDraft,
): Promise<OwnProfile> {
  assertProfileActor(actor);
  const fields = {
    ...draft.fields,
    displayName: draft.fields.displayName.trim(),
    firstName: draft.fields.firstName.trim(),
    lastName: draft.fields.lastName.trim(),
    setupCompleted: true,
  };
  const errors = validateProfile(fields);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  if (draft.photoUri) fields.photoPath = `${actor}/${draft.operationId}.jpg`;
  const operation = { ...draft, fields };
  // The entire text draft and its operation ID must be durable before sending.
  await keepProfileDraft(actor, operation);
  let mayHaveCommitted = !!draft.uncertain;
  try {
    const previous = await readOwnProfile(actor);
    if (previous.version === draft.version) mayHaveCommitted = false;
    if (draft.photoUri && previous.version === draft.version) {
      const bytes = await profilePhotoBytes(draft.photoUri);
      assertProfileActor(actor);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fields.photoPath!, bytes, {
          contentType: 'image/jpeg',
          upsert: false,
          cacheControl: '300',
        });
      // Immutable operation paths: an interrupted prior upload can already exist.
      if (
        error &&
        !['409', 'Duplicate'].includes(
          String((error as { statusCode?: string }).statusCode),
        ) &&
        !/already exists|duplicate/i.test(error.message)
      )
        throw error;
    }
    assertProfileActor(actor);
    await keepProfileDraft(actor, { ...operation, uncertain: true });
    assertProfileActor(actor);
    mayHaveCommitted = true;
    const result: unknown = await rpc('sk_profile_save', {
      p_payload: fields,
      p_version: draft.version,
      p_operation_id: draft.operationId,
      p_user_id: actor,
    });
    assertProfileActor(actor);
    if (!isOwnProfile(result) || result.id !== actor)
      throw new Error('Ungültige Speicherantwort. Bitte erneut speichern.');
    await cacheOwnProfile(result).catch(() => {});
    if (previous.photoPath && previous.photoPath !== result.photoPath)
      await queuePhotoCleanup(actor, previous.photoPath);
    void cleanProfilePhotos(actor, result.photoPath).catch(() => {});
    return result;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'PT409' || code === '22023' || code === '42501')
      mayHaveCommitted = false;
    throw Object.assign(
      error instanceof Error
        ? error
        : new Error('Profil konnte nicht gespeichert werden.'),
      { mayHaveCommitted, code },
    );
  }
}

async function queuePhotoCleanup(actor: string, path: string) {
  const key = `sk-profile-cleanup-${actor}`;
  try {
    const paths: string[] = JSON.parse(
      (await AsyncStorage.getItem(key)) ?? '[]',
    );
    await AsyncStorage.setItem(
      key,
      JSON.stringify([...new Set([...paths, path])]),
    );
  } catch {
    /* Old, unreferenced files are also discovered by the bounded sweep. */
  }
}
export async function cleanProfilePhotos(
  actor: string,
  currentPath: string | null,
) {
  assertProfileActor(actor);
  const key = `sk-profile-cleanup-${actor}`;
  const queued: string[] = JSON.parse(
    (await AsyncStorage.getItem(key)) ?? '[]',
  );
  assertProfileActor(actor);
  const { data } = await supabase.storage.from(bucket).list(actor, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'asc' },
  });
  assertProfileActor(actor);
  const old = (data ?? [])
    .filter(
      (file) => Date.parse(file.created_at ?? '') < Date.now() - 7 * 86400000,
    )
    .map((file) => `${actor}/${file.name}`);
  const paths = [...new Set([...queued, ...old])]
    .filter(
      (path): path is string =>
        typeof path === 'string' &&
        path !== currentPath &&
        new RegExp(`^${actor}/[0-9a-f-]{36}\\.jpg$`).test(path),
    )
    .slice(0, 100);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  assertProfileActor(actor);
  if (!error)
    await AsyncStorage.setItem(
      key,
      JSON.stringify(queued.filter((path) => !paths.includes(path))),
    );
}
