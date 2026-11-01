import { useEffect, useState } from 'react';

import { DEFAULT_USER_APPEARANCE } from '../constants/profileCustomization';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { FriendProfile } from '../types/profile';

export function usePlayerAccounts(query = '', enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  const [result, setResult] = useState<{
    userId?: string;
    query: string;
    accounts: FriendProfile[];
    error: string | null;
  }>({ query: '', accounts: [], error: null });
  useEffect(() => {
    if (!enabled || !userId) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            const { data, error } = await supabase
              .rpc('sk_player_accounts', { p_query: query.trim() })
              .abortSignal(controller.signal);
            if (error) throw error;
            const accounts = (Array.isArray(data) ? data : [])
              .filter(
                (row: { id?: unknown; name?: unknown }) =>
                  typeof row.id === 'string' && typeof row.name === 'string',
              )
              .map((row: { id: string; name: string }) => ({
                id: row.id,
                username: row.name,
                avatarId: DEFAULT_USER_APPEARANCE.avatarId,
                accentColor: DEFAULT_USER_APPEARANCE.accentColor,
              }));
            if (active) setResult({ userId, query, accounts, error: null });
          } catch {
            if (active)
              setResult({
                userId,
                query,
                accounts: [],
                error:
                  'Benutzerkonten konnten nicht geladen werden. Bitte die Verbindung prüfen.',
              });
          }
        })();
      },
      query ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query, userId]);
  return result.userId === userId && result.query === query
    ? result
    : { accounts: [], error: null };
}
