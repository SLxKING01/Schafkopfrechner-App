import 'react-native-url-polyfill/auto';

import { AuthError, createClient, processLock } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabaseConfigError = new AuthError(
  'Supabase ist noch nicht konfiguriert. Bitte EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env setzen.',
);

type SupabaseStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export const ExpoSecureStoreAdapter: SupabaseStorageAdapter = {
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'missing-supabase-key',
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);

const recoveryStorageKey = 'schafkopfrechner-password-recovery';
const recoveryVerifierKey = `${recoveryStorageKey}-code-verifier`;
let recoverySession: string | null = null;

export function clearRecoverySession() {
  recoverySession = null;
}

export const passwordRecoveryClient = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'missing-supabase-key',
  {
    auth: {
      storageKey: recoveryStorageKey,
      storage: {
        getItem: async (key) =>
          key === recoveryVerifierKey
            ? ExpoSecureStoreAdapter.getItem(key)
            : recoverySession,
        setItem: async (key, value) => {
          if (key === recoveryVerifierKey)
            await ExpoSecureStoreAdapter.setItem(key, value);
          else recoverySession = value;
        },
        removeItem: async (key) => {
          if (key === recoveryVerifierKey)
            await ExpoSecureStoreAdapter.removeItem(key);
          else clearRecoverySession();
        },
      },
      flowType: 'pkce',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
    global: {
      fetch: async (input, init) => {
        // React Native can lack Web Crypto. Keep the recovery verifier random
        // and use S256 even when the SDK falls back to a plain challenge.
        if (
          typeof input === 'string' &&
          new URL(input).pathname.endsWith('/recover') &&
          typeof init?.body === 'string'
        ) {
          const body = JSON.parse(init.body);
          if (body.code_challenge_method === 'plain') {
            const verifier = Crypto.randomUUID() + Crypto.randomUUID();
            const challenge = await Crypto.digestStringAsync(
              Crypto.CryptoDigestAlgorithm.SHA256,
              verifier,
              { encoding: Crypto.CryptoEncoding.BASE64 },
            );
            await ExpoSecureStoreAdapter.setItem(
              recoveryVerifierKey,
              JSON.stringify(`${verifier}/recovery`),
            );
            return fetch(input, {
              ...init,
              body: JSON.stringify({
                ...body,
                code_challenge: challenge
                  .replace(/\+/g, '-')
                  .replace(/\//g, '_')
                  .replace(/=+$/, ''),
                code_challenge_method: 's256',
              }),
            });
          }
        }
        return fetch(input, init);
      },
    },
  },
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
      return;
    }

    void supabase.auth.stopAutoRefresh();
  });
}
