import { Lock, Mail } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { AuthInput } from '../components/auth/AuthInput';
import { AuthShell } from '../components/auth/AuthShell';
import { GoldButton } from '../components/auth/GoldButton';
import { MailSentView } from '../components/auth/MailSentView';
import { PasswordRuleList } from '../components/auth/PasswordRuleList';
import { AppButton } from '../components/ui/AppButton';
import { Notice } from '../components/ui/Notice';
import {
  openPasswordRecovery,
  requestPasswordRecovery,
  saveRecoveredPassword,
} from '../services/auth/passwordRecovery';
import { authSpacing } from '../theme/spacing';
import { passwordProblem } from '../utils/passwordRules';

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
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const backLabel = fromAccount ? 'Zurück zum Profil' : 'Zur Anmeldung';

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
      setSentTo(email.trim());
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

  if (sentTo)
    return (
      <AuthShell
        title="E-Mail ist unterwegs"
        subtitle="Öffne den Link auf diesem Gerät, in der App oder im selben Browser."
        footer={null}
      >
        <MailSentView
          email={sentTo}
          message="Wenn es zu dieser Adresse einen Account gibt, bekommst du einen Link an:"
          onResend={async () => {
            try {
              await requestPasswordRecovery(sentTo);
              return null;
            } catch (reason) {
              return reason instanceof Error
                ? reason.message
                : 'Der Link konnte nicht angefordert werden.';
            }
          }}
          backLabel={backLabel}
          onBack={() => navigation.goBack()}
        />
      </AuthShell>
    );

  return (
    <AuthShell
      title={fromAccount ? 'Passwort zurücksetzen' : 'Passwort vergessen?'}
      subtitle="Fordere einen Link an, um ein neues Passwort zu setzen."
      footer={
        <AppButton
          title={backLabel}
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      }
    >
      <View style={formStyle}>
        <AuthInput
          icon={Mail}
          placeholder="E-Mail"
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          editable={!busy}
          hasError={!!error}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError('');
          }}
          onSubmitEditing={() => void send()}
        />
        {error ? <Notice>{error}</Notice> : null}
        <GoldButton
          title="Reset-Link anfordern"
          onPress={send}
          disabled={busy}
          loading={busy}
        />
      </View>
    </AuthShell>
  );
}

export function ResetPasswordScreen({
  code,
  onClose,
  onRequestNewLink,
  closeLabel,
}: {
  code: string | null;
  onClose: () => void;
  /** Opens "Passwort vergessen?" so the user can ask for a fresh link. */
  onRequestNewLink?: () => void;
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
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
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

  const heading =
    phase === 'invalid'
      ? {
          title: 'Link abgelaufen',
          subtitle:
            'Mit diesem Link kannst du kein neues Passwort mehr setzen.',
        }
      : phase === 'saved'
        ? {
            title: 'Passwort geändert',
            subtitle: 'Du kannst dich jetzt mit dem neuen Passwort anmelden.',
          }
        : {
            title: 'Neues Passwort',
            subtitle: 'Setze ein neues Passwort für deinen Account.',
          };

  return (
    <AuthShell
      title={heading.title}
      subtitle={heading.subtitle}
      footer={
        phase === 'ready' ? (
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
        {phase === 'checking' ? (
          <Notice tone="info">Link wird geprüft …</Notice>
        ) : null}
        {phase === 'invalid' ? (
          <>
            <Notice>{invalidLink}</Notice>
            {onRequestNewLink ? (
              <GoldButton
                title="Neuen Link anfordern"
                onPress={onRequestNewLink}
              />
            ) : null}
            <AppButton
              title={closeLabel}
              variant="secondary"
              onPress={onClose}
            />
          </>
        ) : null}
        {phase === 'saved' ? (
          <>
            <Notice tone="success">Dein Passwort wurde geändert.</Notice>
            <GoldButton title={closeLabel} onPress={onClose} />
          </>
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
              hasError={!!error && !!passwordProblem(password)}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError('');
              }}
            />
            <PasswordRuleList password={password} />
            <AuthInput
              icon={Lock}
              placeholder="Passwort bestätigen"
              autoComplete="new-password"
              textContentType="newPassword"
              isPassword
              editable={!busy}
              hasError={!!error && !passwordProblem(password)}
              value={confirmation}
              onChangeText={(value) => {
                setConfirmation(value);
                setError('');
              }}
              onSubmitEditing={() => void save()}
            />
            {error ? <Notice>{error}</Notice> : null}
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
