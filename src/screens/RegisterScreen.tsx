import { Check, Lock, Mail, User } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthInput } from '../components/auth/AuthInput';
import { AuthShell } from '../components/auth/AuthShell';
import { GoldButton } from '../components/auth/GoldButton';
import { MailSentView } from '../components/auth/MailSentView';
import { PasswordRuleList } from '../components/auth/PasswordRuleList';
import { AppText } from '../components/ui/AppText';
import { Notice } from '../components/ui/Notice';
import { isSupabaseConfigured } from '../lib/supabase';
import type { AuthStackScreenProps } from '../navigation/types';
import { register, resendConfirmation } from '../services/auth/register';
import { useAuthStore } from '../store/authStore';
import { authColors } from '../theme/colors';
import { authSpacing } from '../theme/spacing';
import { passwordProblem, signUpErrorMessage } from '../utils/passwordRules';

type RegisterScreenProps = AuthStackScreenProps<'Register'>;
type Field = 'username' | 'email' | 'password' | 'confirm' | 'privacy';

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{ text: string; fields: Field[] }>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);

  const fail = (text: string, ...fields: Field[]) => setError({ text, fields });
  const hasError = (field: Field) => !!error?.fields.includes(field);
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setError(undefined);
  };

  async function handleRegister() {
    if (isSubmitting || sentTo) return;
    setError(undefined);
    const missing: Field[] = [];
    if (!username.trim()) missing.push('username');
    if (!email.trim()) missing.push('email');
    if (!password) missing.push('password');
    if (!confirmPassword) missing.push('confirm');
    if (missing.length) return fail('Bitte alle Felder ausfüllen.', ...missing);

    const name = [...username.trim()];
    if (
      name.length < 2 ||
      name.length > 40 ||
      /[\u0000-\u001f\u007f-\u009f]/.test(username)
    )
      return fail(
        'Der Anzeigename braucht 2 bis 40 Zeichen und darf keine Zeilenumbrüche enthalten.',
        'username',
      );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return fail('Bitte gib eine gültige E-Mail-Adresse ein.', 'email');
    const problem = passwordProblem(password);
    if (problem) return fail(problem, 'password');
    if (password !== confirmPassword)
      return fail('Die Passwörter stimmen nicht überein.', 'confirm');
    if (!privacyAccepted)
      return fail(
        'Bitte bestätige, dass du die Datenschutzerklärung gelesen hast.',
        'privacy',
      );
    if (!isSupabaseConfigured)
      return fail(
        'Die Registrierung ist noch nicht eingerichtet. Du kannst ohne Account spielen.',
      );

    setIsSubmitting(true);
    try {
      const result = await register({ username, email, password });
      if (result.error) fail(signUpErrorMessage(result.error));
      else if (result.session) setSession(result.session);
      else setSentTo(email.trim());
    } catch {
      fail(
        'Die Registrierung ist gerade nicht möglich. Bitte versuche es später erneut.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const loginLink = (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('Login')}
      style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
    >
      <AppText style={styles.footerMuted}>Bereits registriert? </AppText>
      <AppText style={styles.footerAccent}>Anmelden</AppText>
    </Pressable>
  );

  if (sentTo)
    return (
      <AuthShell
        title="Fast geschafft"
        subtitle="Bestätige deine E-Mail-Adresse, dann kannst du dich anmelden."
        footer={null}
      >
        <MailSentView
          email={sentTo}
          message="Wir haben dir einen Bestätigungslink geschickt an:"
          onResend={async () => {
            const { error } = await resendConfirmation(sentTo);
            return error ? signUpErrorMessage(error) : null;
          }}
          backLabel="Zur Anmeldung"
          onBack={() => navigation.navigate('Login')}
        />
      </AuthShell>
    );

  return (
    <AuthShell
      title="Account erstellen"
      subtitle="Speichere Spielstände, Statistiken und Abrechnungen. Dein Profil kannst du anschließend freiwillig ergänzen."
      footer={loginLink}
    >
      <View style={styles.form}>
        <AuthInput
          autoCapitalize="words"
          autoComplete="username"
          editable={!isSubmitting}
          hasError={hasError('username')}
          icon={User}
          placeholder="Anzeigename"
          textContentType="username"
          value={username}
          onChangeText={edit(setUsername)}
        />
        <AuthInput
          autoCapitalize="none"
          autoComplete="email"
          editable={!isSubmitting}
          hasError={hasError('email')}
          icon={Mail}
          keyboardType="email-address"
          placeholder="E-Mail"
          textContentType="emailAddress"
          value={email}
          onChangeText={edit(setEmail)}
        />
        <AuthInput
          autoComplete="new-password"
          editable={!isSubmitting}
          hasError={hasError('password')}
          icon={Lock}
          isPassword
          placeholder="Passwort"
          textContentType="newPassword"
          value={password}
          onChangeText={edit(setPassword)}
        />
        <PasswordRuleList password={password} />
        <AuthInput
          autoComplete="new-password"
          editable={!isSubmitting}
          hasError={hasError('confirm')}
          icon={Lock}
          isPassword
          placeholder="Passwort bestätigen"
          textContentType="newPassword"
          value={confirmPassword}
          onChangeText={edit(setConfirmPassword)}
        />

        <View style={styles.privacyRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: privacyAccepted }}
            accessibilityLabel="Ich habe die Datenschutzerklärung gelesen"
            disabled={isSubmitting}
            hitSlop={8}
            onPress={() => {
              setPrivacyAccepted(!privacyAccepted);
              setError(undefined);
            }}
            style={[
              styles.checkbox,
              privacyAccepted && styles.checkboxOn,
              hasError('privacy') && styles.checkboxError,
            ]}
          >
            {privacyAccepted ? (
              <Check color={authColors.onGold} size={15} strokeWidth={3} />
            ) : null}
          </Pressable>
          <AppText style={styles.privacyText}>
            Ich habe die{' '}
            <AppText
              accessibilityRole="link"
              style={styles.privacyLink}
              onPress={() => navigation.navigate('Legal', { page: 'privacy' })}
            >
              Datenschutzerklärung
            </AppText>{' '}
            gelesen.
          </AppText>
        </View>

        {error ? <Notice>{error.text}</Notice> : null}
        <GoldButton
          title="Account erstellen"
          loading={isSubmitting}
          onPress={handleRegister}
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: authSpacing.md,
  },
  privacyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.sm,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: authColors.gold,
    borderRadius: 6,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxOn: { backgroundColor: authColors.gold },
  checkboxError: { borderColor: authColors.errorBorder },
  privacyText: { color: authColors.textPrimary, flex: 1, fontSize: 14 },
  privacyLink: {
    color: authColors.goldHighlight,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footerLink: {
    flexDirection: 'row',
    padding: authSpacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  footerMuted: {
    color: authColors.textSecondary,
    fontSize: 15,
  },
  footerAccent: {
    color: authColors.goldHighlight,
    fontSize: 15,
    fontWeight: '800',
  },
});
