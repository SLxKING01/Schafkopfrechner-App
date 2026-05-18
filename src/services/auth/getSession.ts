import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { AuthResponse } from '../../types/auth';

export async function getSession(): Promise<AuthResponse> {
  if (!isSupabaseConfigured) {
    return {
      user: null,
      session: null,
      error: null,
    };
  }

  const { data, error } = await supabase.auth.getSession();

  return {
    user: data.session?.user ?? null,
    session: data.session,
    error,
  };
}
