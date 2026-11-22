import { Lock, Mail, User } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthInput } from '../components/auth/AuthInput';
import { AuthShell } from '../components/auth/AuthShell';
import { GoldButton } from '../components/auth/GoldButton';
import { AppText } from '../components/ui/AppText';
import type { AuthStackScreenProps } from '../navigation/types';
import { register } from '../services/auth/register';
import { useAuthStore } from '../store/authStore';
import { authColors } from '../theme/colors';
import { authSpacing } from '../theme/spacing';

type RegisterScreenProps = AuthStackScreenProps<'Register'>;

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmationPending, setConfirmationPending] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function handleRegister() {
    if (isSubmitting || confirmationPending) return;
    setError('');
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }

    if (
      [...username.trim()].length < 2 ||
      [...username.trim()].length > 40 ||
      /[\u0000-\u001f\u007f-\u009f]/.test(username)
    ) {
      setError('Bitte 2 bis 40 Zeichen ohne Zeilenumbrüche eingeben.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register({ username, email, password });
      if (result.error) setError(result.error.message);
      else if (result.session) setSession(result.session);
      else setConfirmationPending(true);
    } catch {
      setError('Registrierung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Neuen Account erstellen"
      subtitle="Speichere Spielstände, Statistiken und Abrechnungen. Dein Profil kannst du anschließend freiwillig ergänzen."
      footer={
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Login')}
          style={({ pressed }) => [
            styles.footerLink,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.footerMuted}>Bereits registriert? </AppText>
          <AppText style={styles.footerAccent}>Anmelden</AppText>
        </Pressable>
      }
    >
      {confirmationPending ? (
        <AppText accessibilityLiveRegion="polite">
          Bitte bestätige deine E-Mail-Adresse, bevor du dich anmeldest.
        </AppText>
      ) : (
        <View style={styles.form}>
          <AuthInput
            autoCapitalize="words"
            autoComplete="username"
            editable={!isSubmitting}
            icon={User}
            placeholder="Anzeigename"
            textContentType="username"
            value={username}
            onChangeText={setUsername}
          />
          <AuthInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!isSubmitting}
            icon={Mail}
            keyboardType="email-address"
            placeholder="E-Mail"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <AuthInput
            autoComplete="new-password"
            editable={!isSubmitting}
            icon={Lock}
            isPassword
            placeholder="Passwort"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
          <AuthInput
            autoComplete="new-password"
            editable={!isSubmitting}
            icon={Lock}
            isPassword
            placeholder="Passwort bestätigen"
            textContentType="newPassword"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
          <GoldButton
            title="Account erstellen"
            loading={isSubmitting}
            onPress={handleRegister}
          />
        </View>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: authSpacing.md,
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
