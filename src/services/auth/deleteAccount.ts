import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { clearRecoverySession, supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { removeLocalProfilePhoto } from '../profile/profilePhoto';
import {
  clearProfileCache,
  removeProfileDraft,
  restoreProfileDraft,
} from '../profile/profileStorage';

export async function deleteAccount(actor: string) {
  const { data } = await supabase.auth.getSession();
  if (
    data.session?.user.id !== actor ||
    useAuthStore.getState().user?.id !== actor
  ) {
    throw new Error('Bitte melde dich erneut an.');
  }

  const { error, response } = await supabase.functions.invoke(
    'delete-account',
    {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      body: { confirm: true },
      timeout: 45000,
    },
  );
  if (error instanceof FunctionsHttpError && error.context.status === 401) {
    throw new Error('Die Sitzung ist abgelaufen. Bitte melde dich erneut an.');
  }
  if (error || response?.status !== 204) {
    throw new Error(
      'Die Löschung konnte nicht bestätigt werden. Bitte versuche es erneut.',
    );
  }

  if (useAuthStore.getState().user?.id === actor) {
    clearRecoverySession();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    if (useAuthStore.getState().user?.id === actor) {
      useAuthStore.getState().setSession(null);
    }
  }
  await Promise.allSettled([
    clearProfileCache(actor),
    AsyncStorage.removeItem(`sk-profile-cleanup-${actor}`),
    (async () => {
      try {
        const draft = await restoreProfileDraft(actor);
        removeLocalProfilePhoto(actor, draft?.photoUri);
      } finally {
        await removeProfileDraft(actor);
      }
    })(),
  ]);
}
