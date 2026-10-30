import { Lock, Mail } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

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

const LOGIN_ERROR_MESSAGE = 'Anmeldedaten sind falsch. Bitte erneut versuchen.';

export function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const errorOpacity = useSharedValue(0);
  const errorTranslateX = useSharedValue(0);
  const hasLoginError = Boolean(loginError);

  const clearLoginError = useCallback(() => {
    setLoginError(null);
  }, []);

  const handleEmailChange = useCallback(
    (value: string) => {
      clearLoginError();
      setEmail(value);
    },
    [clearLoginError],
  );

  const handlePasswordChange = useCallback(
    (value: string) => {
      clearLoginError();
      setPassword(value);
    },
    [clearLoginError],
  );

  useEffect(() => {
    if (!loginError) {
      errorOpacity.value = withTiming(0, { duration: 120 });
      errorTranslateX.value = withTiming(0, { duration: 120 });
      return;
    }

    errorOpacity.value = withTiming(1, { duration: 160 });
    errorTranslateX.value = withSequence(
      withTiming(-7, { duration: 45 }),
      withTiming(7, { duration: 70 }),
      withTiming(-4, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
  }, [errorOpacity, errorTranslateX, loginError]);

  const errorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.value,
    transform: [{ translateX: errorTranslateX.value }],
  }));

  async function handleLogin() {
    if (isSubmitting) {
      return;
    }

    if (!email.trim() || !password) {
      setLoginError(LOGIN_ERROR_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    const result = await login({ email, password });
    setIsSubmitting(false);

    if (result.error || !result.session) {
      setLoginError(LOGIN_ERROR_MESSAGE);
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
          hasError={hasLoginError}
          icon={Mail}
          keyboardType="email-address"
          placeholder="E-Mail"
          textContentType="emailAddress"
          value={email}
          onChangeText={handleEmailChange}
        />
        <AuthInput
          autoComplete="password"
          editable={!isSubmitting}
          hasError={hasLoginError}
          icon={Lock}
          isPassword
          placeholder="Passwort"
          textContentType="password"
          value={password}
          onChangeText={handlePasswordChange}
        />

        {loginError ? (
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[styles.errorBox, errorAnimatedStyle]}
          >
            <AppText style={styles.errorText}>{loginError}</AppText>
          </Animated.View>
        ) : null}

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
            accessibilityState={{ disabled: true }}
            disabled
            style={styles.disabledLink}
          >
            <AppText style={styles.forgotText}>Passwort vergessen?</AppText>
          </Pressable>
        </View>

        <GoldButton
          disabled={isSubmitting}
          loading={isSubmitting}
          title="Anmelden"
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
  disabledLink: {
    opacity: 0.62,
  },
  errorBox: {
    backgroundColor: authColors.errorBackground,
    borderColor: 'rgba(248, 113, 113, 0.24)',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: -authSpacing.xs,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  errorText: {
    color: authColors.errorText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
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
