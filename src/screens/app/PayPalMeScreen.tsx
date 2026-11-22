import { useNavigation } from '@react-navigation/native';
import { Link as LinkIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AuthInput } from '../../components/auth/AuthInput';
import { GoldButton } from '../../components/auth/GoldButton';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';
import { appAlert } from '../../lib/appAlert';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { authColors, authSpacing } from '../../theme';
import { authTypography } from '../../theme/typography';
import { paypalMeHandle } from '../../utils/paypalMe';

export function PayPalMeScreen() {
  const navigation = useNavigation();
  const userId = useAuthStore((state) => state.user?.id);
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const writing = useRef(false);

  useEffect(() => {
    if (!userId) return;
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
  }, [attempt, userId]);

  async function update(remove = false) {
    if (writing.current || saved === undefined) return;
    setSuccess('');
    const handle = remove ? null : paypalMeHandle(draft);
    if (!remove && !handle) {
      setError(
        'Das ist kein gültiger Link. Beispiel: https://paypal.me/DeinName',
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
      setSuccess(remove ? 'Link entfernt.' : 'Gespeichert.');
    } catch {
      setError(
        'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
      );
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  function confirmRemove() {
    appAlert(
      'Link entfernen?',
      'Wer dir aus gemeinsamen Abrechnungen Geld schuldet, kann dann nicht mehr direkt per PayPal bezahlen.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: () => void update(true),
        },
      ],
    );
  }

  async function openLink() {
    if (!saved) return;
    const url = `https://paypal.me/${saved}`;
    try {
      if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
      else await Linking.openURL(url);
    } catch {
      setError('Der Link konnte nicht geöffnet werden.');
    }
  }

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  return (
    <AuthBackground withEdgeBorder={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader title="PayPal.Me-Link" onBack={goBack} />
        {!userId ? (
          <Notice tone="info">
            Einen PayPal.Me-Link kannst du nur mit einem Account hinterlegen.
          </Notice>
        ) : (
          <>
            <AppText style={styles.text}>
              Wer dir aus einer gemeinsamen Abrechnung Geld schuldet, sieht
              diesen Link und kann direkt bezahlen. Ob das Konto dir gehört,
              prüft die App nicht.
            </AppText>
            {saved === undefined ? (
              error ? (
                <AppButton
                  title="Erneut laden"
                  variant="secondary"
                  onPress={() => {
                    setError('');
                    setAttempt((value) => value + 1);
                  }}
                />
              ) : (
                <Notice tone="info">Link wird geladen …</Notice>
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
                  hasError={!!error}
                  onChangeText={(value) => {
                    setDraft(value);
                    setError('');
                    setSuccess('');
                  }}
                />
                {error ? <Notice>{error}</Notice> : null}
                {success ? <Notice tone="success">{success}</Notice> : null}
                <GoldButton
                  title="Link speichern"
                  loading={busy}
                  disabled={
                    busy || !draft.trim() || paypalMeHandle(draft) === saved
                  }
                  onPress={() => void update()}
                />
                {saved ? (
                  <>
                    <AppButton
                      title="Link öffnen"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => void openLink()}
                    />
                    <AppButton
                      title="Link entfernen"
                      variant="danger"
                      disabled={busy}
                      onPress={confirmRemove}
                    />
                  </>
                ) : null}
              </>
            )}
            {saved === undefined && error ? <Notice>{error}</Notice> : null}
          </>
        )}
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: authSpacing.md,
    paddingBottom: authSpacing.xxxl,
    paddingHorizontal: authSpacing.xl,
  },
  text: {
    color: authColors.textSecondary,
    fontSize: authTypography.label,
    lineHeight: 22,
  },
});
