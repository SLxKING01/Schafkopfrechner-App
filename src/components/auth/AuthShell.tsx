import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { AppText } from '../ui/AppText';
import { AuthBackground } from './AuthBackground';
import { AuthLogo } from './AuthLogo';

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <AuthBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(520)}
            style={styles.head}
          >
            <AuthLogo />
            <AppText style={styles.title}>{title}</AppText>
            <AppText style={styles.subtitle}>{subtitle}</AppText>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(560).delay(90)}
            style={styles.cardShadow}
          >
            <BlurView intensity={22} tint="dark" style={styles.card}>
              {children}
            </BlurView>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(520).delay(160)}
            style={styles.footer}
          >
            {footer}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: authSpacing.xl,
    paddingVertical: authSpacing.xxl,
  },
  head: {
    alignItems: 'center',
    marginBottom: authSpacing.xl,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    marginTop: authSpacing.xl,
    textAlign: 'center',
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: authSpacing.sm,
    maxWidth: 300,
    textAlign: 'center',
  },
  cardShadow: {
    borderRadius: authRadius.xl,
    elevation: 8,
    shadowColor: authColors.shadow,
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
  },
  card: {
    backgroundColor: authColors.surfaceElevated,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    padding: authSpacing.lg,
  },
  footer: {
    alignItems: 'center',
    marginTop: authSpacing.xl,
  },
});
