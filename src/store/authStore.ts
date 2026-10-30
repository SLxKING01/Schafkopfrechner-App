import type { AuthError, Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '../lib/supabase';
import { getSession } from '../services/auth/getSession';
import { logout } from '../services/auth/logout';
import type { AuthUser } from '../types/auth';

type AuthStore = {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<() => void>;
  signOut: () => Promise<{ error: AuthError | null }>;
};

let unsubscribeAuthState: (() => void) | null = null;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,
  isAuthenticated: false,

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.user),
    });
  },

  initialize: async () => {
    set({ loading: true });

    if (unsubscribeAuthState) {
      unsubscribeAuthState();
      unsubscribeAuthState = null;
    }

    const result = await getSession();

    set({
      session: result.error ? null : result.session,
      user: result.error ? null : result.user,
      isAuthenticated: result.error ? false : Boolean(result.user),
      initialized: true,
      loading: false,
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session?.user),
        initialized: true,
        loading: false,
      });
    });

    unsubscribeAuthState = () => {
      data.subscription.unsubscribe();
    };

    return unsubscribeAuthState;
  },

  signOut: async () => {
    set({ loading: true });

    const { error } = await logout();

    if (!error) {
      set({
        user: null,
        session: null,
        isAuthenticated: false,
      });
    }

    set({ loading: false });

    return { error };
  },
}));
