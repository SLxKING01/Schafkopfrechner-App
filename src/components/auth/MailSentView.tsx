import { MailCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { authColors, authSpacing } from '../../theme';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';
import { Notice } from '../ui/Notice';
import { GoldButton } from './GoldButton';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Shown after an e-mail was sent (sign-up confirmation, password reset):
 * where it went, a spam hint, "Erneut senden" with a cooldown, and a way back.
 */
export function MailSentView({
  email,
  message,
  onResend,
  backLabel,
  onBack,
}: {
  email: string;
  message: string;
  onResend: () => Promise<string | null>;
  backLabel: string;
  onBack: () => void;
}) {
  const [wait, setWait] = useState(RESEND_COOLDOWN_SECONDS);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    if (busy || wait > 0) return;
    setBusy(true);
    setResult(undefined);
    const error = await onResend().catch(
      () => 'Die E-Mail konnte nicht gesendet werden.',
    );
    setBusy(false);
    setWait(RESEND_COOLDOWN_SECONDS);
    setResult(
      error
        ? { ok: false, text: error }
        : { ok: true, text: 'Wir haben die E-Mail erneut gesendet.' },
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        <MailCheck
          color={authColors.goldHighlight}
          size={34}
          strokeWidth={1.8}
        />
        <AppText accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </AppText>
        {email ? (
          <AppText selectable style={styles.email}>
            {email}
          </AppText>
        ) : null}
      </View>
      <Notice tone="info">
        Keine E-Mail bekommen? Schau auch im Spam-Ordner nach. Es kann ein paar
        Minuten dauern.
      </Notice>
      {result ? (
        <Notice tone={result.ok ? 'success' : 'error'}>{result.text}</Notice>
      ) : null}
      <AppButton
        title={wait > 0 ? `Erneut senden (${wait} s)` : 'Erneut senden'}
        variant="secondary"
        disabled={wait > 0}
        loading={busy}
        onPress={() => void resend()}
      />
      <GoldButton title={backLabel} onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: authSpacing.md },
  head: { alignItems: 'center', gap: authSpacing.sm },
  message: {
    color: authColors.textPrimary,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  email: { color: authColors.goldHighlight, fontSize: 15, fontWeight: '700' },
});
