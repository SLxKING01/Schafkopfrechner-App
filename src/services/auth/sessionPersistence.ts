import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Set when the user signed in with "Angemeldet bleiben" switched off.
const temporaryKey = 'schafkopfrechner-session-temporary';
// Web only: lives in sessionStorage, so it disappears when the browser
// tab/window is closed but survives reloads.
const browserSessionKey = 'schafkopfrechner-session-alive';

function markBrowserSession() {
  try {
    window.sessionStorage.setItem(browserSessionKey, '1');
  } catch {
    // Without sessionStorage the session simply ends on the next start.
  }
}

function hasBrowserSession() {
  try {
    return window.sessionStorage.getItem(browserSessionKey) === '1';
  } catch {
    return false;
  }
}

/** Remembers how long the new session should last. */
export async function rememberSessionChoice(stayLoggedIn: boolean) {
  if (stayLoggedIn) {
    await AsyncStorage.removeItem(temporaryKey);
    return;
  }
  await AsyncStorage.setItem(temporaryKey, '1');
  if (Platform.OS === 'web') markBrowserSession();
}

export async function clearSessionChoice() {
  await AsyncStorage.removeItem(temporaryKey);
}

/**
 * True when a stored session belongs to a sign-in without "Angemeldet
 * bleiben" and the app has been restarted since (native: every cold start;
 * web: once the browser session has ended).
 */
export async function shouldDiscardStoredSession() {
  if ((await AsyncStorage.getItem(temporaryKey)) !== '1') return false;
  if (Platform.OS === 'web' && hasBrowserSession()) return false;
  return true;
}
