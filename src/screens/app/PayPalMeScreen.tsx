import { Link as LinkIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AuthInput } from '../../components/auth/AuthInput';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { supabase } from '../../lib/supabase';
import { authSpacing } from '../../theme/spacing';
import { paypalMeHandle } from '../../utils/paypalMe';

export function PayPalMeScreen() {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const writing = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('sk_get_paypal_me');
        if (error) throw error;
        if (active) {
          setSaved(data);
          setDraft(data ? `https://paypal.me/${data}` : '');
        }
      } catch {
        if (active)
          setError('Dein PayPal.Me-Link konnte nicht geladen werden.');
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  async function update(remove = false) {
    if (writing.current || saved === undefined) return;
    const handle = remove ? null : paypalMeHandle(draft);
    if (!remove && !handle) {
      setError(
        'Gib einen gültigen Link ein, zum Beispiel https://paypal.me/DeinName.',
      );
      return;
    }
    writing.current = true;
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.rpc('sk_set_paypal_me', {
        p_handle: handle,
      });
      if (error) throw error;
      setSaved(handle);
      setDraft(handle ? `https://paypal.me/${handle}` : '');
    } catch {
      setError(
        'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
      );
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthBackground withEdgeBorder={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppText>
          Hinterlege deinen PayPal.Me-Link für Zahlungen aus gemeinsamen
          Tischabrechnungen. Der Link wird dem jeweiligen Zahler angezeigt. Die
          Kontoinhaberschaft wird nicht geprüft.
        </AppText>
        {saved === undefined ? (
          error ? (
            <AppButton
              title="Erneut laden"
              onPress={() => {
                setError('');
                setAttempt((value) => value + 1);
              }}
            />
          ) : (
            <AppText>Link wird geladen …</AppText>
          )
        ) : (
          <>
            <AuthInput
              icon={LinkIcon}
              placeholder="https://paypal.me/DeinName"
              accessibilityLabel="PayPal.Me-Link"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={draft}
              editable={!busy}
              onChangeText={setDraft}
            />
            <AppButton
              title="Link speichern"
              disabled={
                busy || !draft.trim() || paypalMeHandle(draft) === saved
              }
              onPress={() => void update()}
            />
            {saved ? (
              <AppButton
                title="Link entfernen"
                variant="secondary"
                disabled={busy}
                onPress={() => void update(true)}
              />
            ) : null}
          </>
        )}
        {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: authSpacing.xl, gap: authSpacing.md },
});
