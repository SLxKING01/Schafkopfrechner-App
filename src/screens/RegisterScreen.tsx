import { Apple, Lock, Mail, User } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthInput } from '../components/auth/AuthInput';
import { AuthShell } from '../components/auth/AuthShell';
import { GoldButton } from '../components/auth/GoldButton';
import { SocialButton } from '../components/auth/SocialButton';
import { AppText } from '../components/ui/AppText';
import { appAlert } from '../lib/appAlert';
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
  const setSession = useAuthStore((state) => state.setSession);

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      appAlert('Registrierung unvollständig', 'Bitte alle Felder ausfüllen.');
      return;
    }

    if (
      [...username.trim()].length < 2 ||
      [...username.trim()].length > 40 ||
      /[\u0000-\u001f\u007f-\u009f]/.test(username)
    ) {
      appAlert(
        'Anzeigename prüfen',
        'Bitte 2 bis 40 Zeichen ohne Zeilenumbrüche eingeben.',
      );
      return;
    }
    if (password !== confirmPassword) {
      appAlert(
        'Passwörter stimmen nicht überein',
        'Bitte prüfe deine Eingabe.',
      );
      return;
    }

    setIsSubmitting(true);
    const result = await register({ username, email, password });
    setIsSubmitting(false);

    if (result.error) {
      appAlert('Registrierung fehlgeschlagen', result.error.message);
      return;
    }

    if (result.session) {
      setSession(result.session);
      return;
    }

    appAlert(
      'Account erstellt',
      'Bitte bestätige deine E-Mail-Adresse, bevor du dich anmeldest.',
      [{ text: 'Zum Login', onPress: () => navigation.navigate('Login') }],
    );
  }

  function showSocialPending() {
    appAlert(
      'Social Login',
      'Apple und Google Login werden nach der Supabase Provider-Konfiguration aktiviert.',
    );
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

        <View style={styles.socialRow}>
          <SocialButton
            icon={Apple}
            title="Apple"
            onPress={showSocialPending}
          />
          <SocialButton
            icon={Mail}
            title="Google"
            onPress={showSocialPending}
          />
        </View>

        <GoldButton
          title={isSubmitting ? 'Erstellen...' : 'Account erstellen'}
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
  socialRow: {
    flexDirection: 'row',
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
