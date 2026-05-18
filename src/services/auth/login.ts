import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../../lib/supabase';
import type { AuthResponse, LoginPayload } from '../../types/auth';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  if (!isSupabaseConfigured) {
    return {
      user: null,
      session: null,
      error: supabaseConfigError,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(payload.email),
    password: payload.password,
  });

  return {
    user: data.user,
    session: data.session,
    error,
  };
}
