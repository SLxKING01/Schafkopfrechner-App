import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../../lib/supabase';

export async function logout() {
  if (!isSupabaseConfigured) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.auth.signOut();

  return { error };
}
