import { Lock, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AuthInput } from '../components/auth/AuthInput';
import { AuthShell } from '../components/auth/AuthShell';
import { GoldButton } from '../components/auth/GoldButton';
import { AppText } from '../components/ui/AppText';
import type { AuthStackScreenProps } from '../navigation/types';
import { login } from '../services/auth/login';
import { useAuthStore } from '../store/authStore';
import { authColors } from '../theme/colors';
import { authSpacing } from '../theme/spacing';

type LoginScreenProps = AuthStackScreenProps<'Login'>;

export function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Login unvollständig', 'Bitte E-Mail und Passwort eingeben.');
      return;
    }

    setIsSubmitting(true);
    const result = await login({ email, password });
    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Anmeldung fehlgeschlagen', result.error.message);
      return;
    }

    setSession(result.session);
  }

  return (
    <AuthShell
      title="Willkommen zurück"
      subtitle="Melde dich an und spiele mit deinen Freunden."
      footer={
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Register')}
          style={({ pressed }) => [
            styles.footerLink,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.footerMuted}>Noch keinen Account? </AppText>
          <AppText style={styles.footerAccent}>Registrieren</AppText>
        </Pressable>
      }
    >
      <View style={styles.form}>
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
          autoComplete="password"
          editable={!isSubmitting}
          icon={Lock}
          isPassword
          placeholder="Passwort"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />

        <View style={styles.optionsRow}>
          <View style={styles.rememberRow}>
            <Switch
              disabled={isSubmitting}
              ios_backgroundColor="rgba(245, 245, 245, 0.16)"
              onValueChange={setRememberMe}
              thumbColor={rememberMe ? authColors.goldHighlight : '#D1D5DB'}
              trackColor={{
                false: 'rgba(245, 245, 245, 0.16)',
                true: 'rgba(212, 175, 55, 0.42)',
              }}
              value={rememberMe}
            />
            <AppText style={styles.optionText}>Angemeldet bleiben</AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(
                'Passwort zurücksetzen',
                'Der Reset-Flow wird als nächstes mit Supabase OTP ergänzt.',
              )
            }
          >
            <AppText style={styles.forgotText}>Passwort vergessen?</AppText>
          </Pressable>
        </View>

        <GoldButton
          title={isSubmitting ? 'Anmelden...' : 'Anmelden'}
          onPress={handleLogin}
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: authSpacing.md,
  },
  optionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: authSpacing.sm,
    marginTop: authSpacing.xs,
  },
  rememberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.sm,
  },
  optionText: {
    color: authColors.textSecondary,
    fontSize: 13,
  },
  forgotText: {
    color: authColors.goldHighlight,
    fontSize: 13,
    fontWeight: '700',
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
