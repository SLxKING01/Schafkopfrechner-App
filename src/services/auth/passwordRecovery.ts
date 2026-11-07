import { Platform } from 'react-native';

import {
  clearRecoverySession,
  isSupabaseConfigured,
  passwordRecoveryClient,
} from '../../lib/supabase';

const nativeCallback = 'schafkopfrechner://passwort-zuruecksetzen';

function callbackURL() {
  if (Platform.OS !== 'web') return nativeCallback;
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('recovery', '1');
  return url.href;
}

export function parseRecoveryLink(raw: string) {
  try {
    const url = new URL(raw);
    const native =
      url.protocol === 'schafkopfrechner:' &&
      url.host === 'passwort-zuruecksetzen' &&
      (url.pathname === '' || url.pathname === '/');
    const web =
      Platform.OS === 'web' &&
      url.origin === window.location.origin &&
      url.searchParams.get('recovery') === '1';
    if (!native && !web) return null;
    return { code: url.searchParams.get('code'), web };
  } catch {
    return null;
  }
}

export async function requestPasswordRecovery(email: string) {
  if (!isSupabaseConfigured)
    throw new Error(
      'Die Passwort-Wiederherstellung ist derzeit nicht verfügbar.',
    );
  const { error } = await passwordRecoveryClient.auth.resetPasswordForEmail(
    email.trim(),
    { redirectTo: callbackURL() },
  );
  if (error?.status === 429)
    throw new Error(
      'Zu viele Anfragen. Bitte warte kurz und versuche es erneut.',
    );
  if (error && error.code !== 'user_not_found')
    throw new Error(
      'Der Link konnte nicht angefordert werden. Bitte versuche es erneut.',
    );
}

export async function openPasswordRecovery(code: string) {
  if (!isSupabaseConfigured) return false;
  clearRecoverySession();
  const { data, error } =
    await passwordRecoveryClient.auth.exchangeCodeForSession(code);
  return !error && !!data.session;
}

export async function saveRecoveredPassword(password: string) {
  const { error } = await passwordRecoveryClient.auth.updateUser({ password });
  if (error?.code === 'same_password')
    throw new Error(
      'Wähle ein Passwort, das sich vom bisherigen unterscheidet.',
    );
  if (error?.code === 'weak_password')
    throw new Error(
      'Das Passwort erfüllt die Sicherheitsanforderungen nicht. Wähle ein stärkeres Passwort.',
    );
  if (error)
    throw new Error(
      'Das Passwort konnte nicht gespeichert werden. Bitte versuche es erneut oder fordere einen neuen Link an.',
    );
  clearRecoverySession();
}
