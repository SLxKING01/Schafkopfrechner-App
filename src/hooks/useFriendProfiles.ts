import { useEffect, useState } from 'react';

import {
  DEFAULT_USER_APPEARANCE,
  PROFILE_ACCENTS,
} from '../constants/profileCustomization';
import { readFriends } from '../services/friends/friends';
import { useAuthStore } from '../store/authStore';
import type { FriendProfile } from '../types/profile';

export function useFriendProfiles() {
  const actor = useAuthStore((s) => s.user?.id);
  const [result, setResult] = useState<{
    actor?: string;
    accounts: FriendProfile[];
    error: string | null;
  }>({ accounts: [], error: null });
  useEffect(() => {
    if (!actor) return;
    let active = true;
    void readFriends(actor)
      .then((state) => {
        if (active)
          setResult({
            actor,
            error: null,
            accounts: state.friends.map(({ profile: p }) => ({
              id: p.id,
              username: p.displayName,
              avatarId: p.animalId ?? DEFAULT_USER_APPEARANCE.avatarId,
              accentColor: PROFILE_ACCENTS[p.accentId],
              avatarKind: p.avatarKind,
              accentId: p.accentId,
              photoPath: p.photoPath,
            })),
          });
      })
      .catch(() => {
        if (active)
          setResult({
            actor,
            accounts: [],
            error:
              'Freunde konnten nicht geladen werden. Lokale Spieler können weiterhin angelegt werden.',
          });
      });
    return () => {
      active = false;
    };
  }, [actor]);
  return result.actor === actor ? result : { accounts: [], error: null };
}
