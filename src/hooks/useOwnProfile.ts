import { useEffect } from 'react';
import { AppState } from 'react-native';

import { clearProfileCache } from '../services/profile/profileStorage';
import { useAuthStore } from '../store/authStore';
import { refreshOwnProfile, useProfileStore } from '../store/profileStore';
import { legacyDisplayName } from '../utils/profile';

export function useOwnProfile() {
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) =>
    state.ownerId === user?.id ? state.profile : null,
  );
  const error = useProfileStore((state) =>
    state.ownerId === user?.id ? state.error : null,
  );
  const loading = useProfileStore((state) =>
    state.ownerId === user?.id ? state.loading : !!user,
  );
  return {
    profile,
    error,
    loading,
    displayName: profile?.displayName ?? legacyDisplayName(user),
  };
}
export function useProfileSession() {
  const id = useAuthStore((state) => state.user?.id);
  useEffect(() => {
    useProfileStore.setState({
      ownerId: id ?? null,
      profile: null,
      loading: !!id,
      error: null,
    });
    if (!id) return;
    void refreshOwnProfile(id);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshOwnProfile(id);
    });
    return () => {
      listener.remove();
      void clearProfileCache(id).catch(() => {});
    };
  }, [id]);
}
