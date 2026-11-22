import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useProfileStore } from '../../store/profileStore';
import { clearGameState } from '../persistence/clearGameState';
import {
  clearProfileCache,
  removeProfileDraft,
} from '../profile/profileStorage';

const PHOTO_BUCKET = 'profile-photos';

export type DeleteAccountResult =
  | { ok: true; transferredTables: number; deletedTables: number }
  | { ok: false; message: string };

function failure(message: string): DeleteAccountResult {
  return { ok: false, message };
}

async function removeOwnPhotos(actor: string) {
  // Storage lists at most `limit` entries per call; repeat until the folder is empty.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .list(actor, { limit: 100 });
    if (error) throw new Error(error.message);
    const paths = (data ?? []).map((file) => `${actor}/${file.name}`);
    if (!paths.length) return;
    const removed = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (removed.error) throw new Error(removed.error.message);
  }
  throw new Error('Profilfotos konnten nicht vollständig entfernt werden.');
}

async function clearLocalAccountData(actor: string) {
  await Promise.allSettled([
    clearProfileCache(actor),
    removeProfileDraft(actor),
  ]);
  useProfileStore.setState({
    ownerId: null,
    profile: null,
    loading: false,
    error: null,
  });

  // Local tables that were synced to the deleted account must not stay behind
  // or be uploaded into a later account on this device.
  if (useGameStore.getState().cloudOwnerId === actor) {
    useGameStore.setState({
      games: [],
      archivedGameDays: [],
      currentTable: null,
      players: [],
      rounds: [],
      balances: [],
      settlements: [],
      activeGame: false,
      tableOrderIds: [],
      lastSyncedAt: null,
      syncError: null,
      cloudOwnerId: null,
      cloudVersion: null,
      cloudBaseline: null,
    });
    await clearGameState().catch(() => undefined);
  }
}

/**
 * Permanently deletes the signed-in account: profile photos, profile, friends,
 * invitations, cloud game state and PayPal.Me link. Shared tables owned by the
 * account move to another member, or are deleted when nobody else is left.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  if (!isSupabaseConfigured) {
    return failure(supabaseConfigError?.message ?? 'Keine Verbindung.');
  }
  const actor = useAuthStore.getState().user?.id;
  if (!actor) return failure('Bitte zuerst anmelden.');

  try {
    const released = await supabase.rpc('sk_account_release_photo');
    if (released.error) return failure(released.error.message);

    await removeOwnPhotos(actor);

    const { data, error } = await supabase.rpc('sk_account_delete');
    if (error) return failure(error.message);

    await clearLocalAccountData(actor);
    // The server session is already gone with the user; only drop it locally.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    useAuthStore.getState().setSession(null);

    const summary = (data ?? {}) as {
      transferredTables?: number;
      deletedTables?: number;
    };
    return {
      ok: true,
      transferredTables: summary.transferredTables ?? 0,
      deletedTables: summary.deletedTables ?? 0,
    };
  } catch (cause) {
    return failure(
      cause instanceof Error
        ? cause.message
        : 'Konto konnte nicht gelöscht werden. Bitte erneut versuchen.',
    );
  }
}
