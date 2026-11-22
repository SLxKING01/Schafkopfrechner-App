import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../../lib/supabase';
import type { AuthResponse, RegisterPayload } from '../../types/auth';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function register(
  payload: RegisterPayload,
): Promise<AuthResponse> {
  if (!isSupabaseConfigured) {
    return {
      user: null,
      session: null,
      error: supabaseConfigError,
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(payload.email),
    password: payload.password,
    options: {
      data: {
        username: payload.username.trim(),
      },
    },
  });

  return {
    user: data.user,
    session: data.session,
    error,
  };
}

/** Sends the sign-up confirmation e-mail again. */
export async function resendConfirmation(email: string) {
  if (!isSupabaseConfigured) return { error: supabaseConfigError };
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizeEmail(email),
  });
  return { error };
}
