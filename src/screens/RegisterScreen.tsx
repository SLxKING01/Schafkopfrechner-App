import {
  Apple,
  BarChart3,
  Calculator,
  Lock,
  Mail,
  User,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AuthInput } from '../components/auth/AuthInput';
import { AuthShell } from '../components/auth/AuthShell';
import { GoldButton } from '../components/auth/GoldButton';
import { SocialButton } from '../components/auth/SocialButton';
import { AppText } from '../components/ui/AppText';
import type { AuthStackScreenProps } from '../navigation/types';
import { register } from '../services/auth/register';
import { useAuthStore } from '../store/authStore';
import { authColors } from '../theme/colors';
import { authRadius, authSpacing } from '../theme/spacing';

type RegisterScreenProps = AuthStackScreenProps<'Register'>;

const features = [
  { label: 'Spielstaende speichern', icon: Calculator },
  { label: 'Freunde einladen', icon: Users },
  { label: 'Automatisch abrechnen', icon: UserPlus },
  { label: 'Statistiken verfolgen', icon: BarChart3 },
];

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert(
        'Registrierung unvollstaendig',
        'Bitte alle Felder ausfuellen.',
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Passwoerter stimmen nicht ueberein',
        'Bitte pruefe deine Eingabe.',
      );
      return;
    }

    setIsSubmitting(true);
    const result = await register({ username, email, password });
    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Registrierung fehlgeschlagen', result.error.message);
      return;
    }

    if (result.session) {
      setSession(result.session);
      return;
    }

    Alert.alert(
      'Account erstellt',
      'Bitte bestaetige deine E-Mail-Adresse, bevor du dich anmeldest.',
      [{ text: 'Zum Login', onPress: () => navigation.navigate('Login') }],
    );
  }

  function showSocialPending() {
    Alert.alert(
      'Social Login',
      'Apple und Google Login werden nach der Supabase Provider-Konfiguration aktiviert.',
    );
  }

  return (
    <AuthShell
      title="Neuen Account erstellen"
      subtitle="Speichere Spielstaende, Statistiken und Abrechnungen."
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
          placeholder="Benutzername"
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
          placeholder="Passwort bestaetigen"
          textContentType="newPassword"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <View style={styles.featureCard}>
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <View key={feature.label} style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Icon
                    color={authColors.accentGreen}
                    size={16}
                    strokeWidth={2}
                  />
                </View>
                <AppText style={styles.featureText}>{feature.label}</AppText>
              </View>
            );
          })}
        </View>

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
  featureCard: {
    backgroundColor: 'rgba(107, 163, 110, 0.1)',
    borderColor: 'rgba(107, 163, 110, 0.2)',
    borderRadius: authRadius.lg,
    borderWidth: 1,
    gap: authSpacing.sm,
    padding: authSpacing.md,
  },
  featureItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.sm,
  },
  featureIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(107, 163, 110, 0.14)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  featureText: {
    color: authColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
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
