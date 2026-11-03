import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { readProfileCards } from '../services/profile/profiles';
import { useAuthStore } from '../store/authStore';
import type { ProfileCard } from '../types/profile';
import { useOwnProfile } from './useOwnProfile';

export function useAccountProfiles(ids: string[]) {
  const actor = useAuthStore((state) => state.user?.id);
  const { profile: own } = useOwnProfile();
  const key = JSON.stringify([...new Set(ids)].sort());
  const [result, setResult] = useState<{
    actor: string;
    key: string;
    cards: Record<string, ProfileCard>;
  } | null>(null);
  useEffect(() => {
    if (!actor || key === '[]') return;
    let active = true;
    const load = () => {
      void readProfileCards(actor, JSON.parse(key))
        .then((cards) => {
          if (active)
            setResult({
              actor,
              key,
              cards: Object.fromEntries(cards.map((card) => [card.id, card])),
            });
        })
        .catch(() => {
          /* Preserve table/player names if profile metadata is unavailable. */
        });
    };
    load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [actor, key, own?.version]);
  const cards =
    result && result.actor === actor && result.key === key ? result.cards : {};
  return own ? { ...cards, [own.id]: own } : cards;
}
