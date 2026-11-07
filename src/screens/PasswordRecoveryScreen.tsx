import { Lock, Mail } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { AuthInput } from '../components/auth/AuthInput';
import { AuthShell } from '../components/auth/AuthShell';
import { GoldButton } from '../components/auth/GoldButton';
import { AppButton } from '../components/ui/AppButton';
import { AppText } from '../components/ui/AppText';
import {
  openPasswordRecovery,
  requestPasswordRecovery,
  saveRecoveredPassword,
} from '../services/auth/passwordRecovery';
import { authSpacing } from '../theme/spacing';

const formStyle = { gap: authSpacing.md };
const invalidLink =
  'Der Link ist ungültig, abgelaufen oder wurde auf einem anderen Gerät angefordert.';

export function RequestPasswordScreen({
  route,
  navigation,
}: {
  route: { params?: { email?: string; fromAccount?: boolean } };
  navigation: { goBack: () => void };
}) {
  const fromAccount = route.params?.fromAccount === true;
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function send() {
    if (lock.current) return;
    if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await requestPasswordRecovery(email);
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Der Link konnte nicht angefordert werden.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={fromAccount ? 'Passwort zurücksetzen' : 'Passwort vergessen?'}
      subtitle="Fordere einen Link an, um ein neues Passwort zu setzen."
      footer={
        <AppButton
          title={fromAccount ? 'Zurück zum Profil' : 'Zur Anmeldung'}
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      }
    >
      <View style={formStyle}>
        {sent ? (
          <AppText accessibilityLiveRegion="polite">
            Wenn es zu dieser Adresse ein Konto gibt, erhältst du eine E-Mail.
            Öffne den Link auf demselben Gerät in der App oder im selben
            Browser, in dem du ihn angefordert hast.
          </AppText>
        ) : (
          <>
            <AuthInput
              icon={Mail}
              placeholder="E-Mail"
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              editable={!busy}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError('');
              }}
              onSubmitEditing={() => void send()}
            />
            {error ? (
              <AppText accessibilityRole="alert">{error}</AppText>
            ) : null}
            <GoldButton
              title="Reset-Link anfordern"
              onPress={send}
              disabled={busy}
              loading={busy}
            />
          </>
        )}
      </View>
    </AuthShell>
  );
}

export function ResetPasswordScreen({
  code,
  onClose,
  closeLabel,
}: {
  code: string | null;
  onClose: () => void;
  closeLabel: string;
}) {
  const [phase, setPhase] = useState<
    'checking' | 'ready' | 'invalid' | 'saved'
  >('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const exchange = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let mounted = true;
    exchange.current ??= code
      ? openPasswordRecovery(code).catch(() => false)
      : Promise.resolve(false);
    void exchange.current.then((valid) => {
      if (mounted) setPhase(valid ? 'ready' : 'invalid');
    });
    return () => {
      mounted = false;
    };
  }, [code]);

  async function save() {
    if (phase !== 'ready' || lock.current) return;
    if (password.length < 6) {
      setError('Das Passwort muss mindestens sechs Zeichen lang sein.');
      return;
    }
    if (password !== confirmation) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await saveRecoveredPassword(password);
      setPassword('');
      setConfirmation('');
      setPhase('saved');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Das Passwort konnte nicht gespeichert werden.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Neues Passwort"
      subtitle="Setze ein neues Passwort für dein Konto."
      footer={
        phase !== 'checking' ? (
          <AppButton
            title={closeLabel}
            variant="secondary"
            disabled={busy}
            onPress={onClose}
          />
        ) : null
      }
    >
      <View style={formStyle}>
        {phase === 'checking' ? <AppText>Link wird geprüft …</AppText> : null}
        {phase === 'invalid' ? (
          <AppText accessibilityRole="alert">
            {invalidLink} Fordere bei der Anmeldung einen neuen Link an.
          </AppText>
        ) : null}
        {phase === 'saved' ? (
          <AppText accessibilityLiveRegion="polite">
            Dein Passwort wurde geändert. Du kannst dich jetzt damit anmelden.
          </AppText>
        ) : null}
        {phase === 'ready' ? (
          <>
            <AuthInput
              icon={Lock}
              placeholder="Neues Passwort"
              autoComplete="new-password"
              textContentType="newPassword"
              isPassword
              editable={!busy}
              value={password}
              onChangeText={setPassword}
            />
            <AuthInput
              icon={Lock}
              placeholder="Passwort bestätigen"
              autoComplete="new-password"
              textContentType="newPassword"
              isPassword
              editable={!busy}
              value={confirmation}
              onChangeText={setConfirmation}
              onSubmitEditing={() => void save()}
            />
            {error ? (
              <AppText accessibilityRole="alert">{error}</AppText>
            ) : null}
            <GoldButton
              title="Passwort speichern"
              disabled={busy}
              loading={busy}
              onPress={save}
            />
          </>
        ) : null}
      </View>
    </AuthShell>
  );
}
