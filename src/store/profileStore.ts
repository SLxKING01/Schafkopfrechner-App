import { create } from 'zustand';

import {
  cleanProfilePhotos,
  readOwnProfile,
} from '../services/profile/profiles';
import { cachedOwnProfile } from '../services/profile/profileStorage';
import type { OwnProfile } from '../types/profile';
import { useAuthStore } from './authStore';

export const useProfileStore = create<{
  ownerId: string | null;
  profile: OwnProfile | null;
  loading: boolean;
  error: string | null;
}>(() => ({ ownerId: null, profile: null, loading: false, error: null }));
const pending = new Map<string, Promise<void>>();
export function acceptOwnProfile(profile: OwnProfile) {
  const current = useProfileStore.getState();
  if (
    useAuthStore.getState().user?.id === profile.id &&
    (current.ownerId !== profile.id ||
      !current.profile ||
      current.profile.version <= profile.version)
  )
    useProfileStore.setState({
      ownerId: profile.id,
      profile,
      loading: false,
      error: null,
    });
}
export function refreshOwnProfile(actor: string): Promise<void> {
  const existing = pending.get(actor);
  if (existing) return existing;
  const task = (async () => {
    if (useAuthStore.getState().user?.id !== actor) return;
    if (useProfileStore.getState().ownerId !== actor)
      useProfileStore.setState({
        ownerId: actor,
        profile: null,
        error: null,
        loading: true,
      });
    else useProfileStore.setState({ loading: true });
    try {
      if (!useProfileStore.getState().profile) {
        const cached = await cachedOwnProfile(actor).catch(() => null);
        if (cached && useAuthStore.getState().user?.id === actor)
          acceptOwnProfile(cached);
      }
      const profile = await readOwnProfile(actor);
      acceptOwnProfile(profile);
      void cleanProfilePhotos(actor, profile.photoPath).catch(() => {});
    } catch (error) {
      if (useAuthStore.getState().user?.id === actor)
        useProfileStore.setState({
          error:
            error instanceof Error
              ? error.message
              : 'Profil konnte nicht geladen werden.',
        });
    } finally {
      if (useAuthStore.getState().user?.id === actor)
        useProfileStore.setState({ loading: false });
    }
  })().finally(() => pending.delete(actor));
  pending.set(actor, task);
  return task;
}
