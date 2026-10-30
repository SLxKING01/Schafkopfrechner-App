import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';

import { AppText } from '../components/ui/AppText';
import { theme } from '../constants/theme';
import type { AuthStackScreenProps } from '../navigation/types';

type OnboardingScreenProps = AuthStackScreenProps<'Onboarding'>;

const colors = {
  background: '#161816',
  surface: '#2F6B2F',
  surfaceDeep: '#203A20',
  accent: '#D9A441',
  text: '#F5F5F5',
  mutedText: 'rgba(245, 245, 245, 0.66)',
  softText: 'rgba(245, 245, 245, 0.42)',
  positive: '#5BBE63',
  negative: '#D65A5A',
};

export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  function continueOffline() {
    navigation.navigate('MainTabs');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundPattern} pointerEvents="none">
        <AppText style={[styles.patternSuit, styles.patternSuitTop]}>♥</AppText>
        <AppText style={[styles.patternSuit, styles.patternSuitMiddle]}>
          ♣
        </AppText>
        <AppText style={[styles.patternSuit, styles.patternSuitBottom]}>
          ♥
        </AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logoShadow}>
            <View style={styles.logo}>
              <Ionicons name="leaf-outline" size={34} color={colors.accent} />
              <Ionicons
                name="heart-outline"
                size={21}
                color={colors.accent}
                style={styles.logoHeart}
              />
            </View>
          </View>

          <View style={styles.titleGroup}>
            <AppText style={styles.title}>Schafkopfrechner</AppText>
            <AppText style={styles.subtitle}>
              Gemeinsam spielen. Einfach abrechnen.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <AppText style={styles.primaryButtonText}>Anmelden</AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Register')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <AppText style={styles.secondaryButtonText}>Registrieren</AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={continueOffline}
            style={({ pressed }) => [
              styles.offlineButton,
              pressed && styles.offlinePressed,
            ]}
          >
            <AppText style={styles.offlineText}>Ohne Account spielen →</AppText>
          </Pressable>

          <View style={styles.featureCard}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <AppText style={styles.featureText}>Mit Freunden spielen</AppText>
            </View>

            <View style={styles.featureDivider} />

            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons
                  name="swap-vertical-outline"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <AppText style={styles.featureText}>
                Automatisch abrechnen
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <AppText style={styles.footerText}>Datenschutz · Impressum</AppText>
          <AppText style={styles.versionText}>Version 1.0.0</AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternSuit: {
    color: 'rgba(217, 164, 65, 0.06)',
    fontSize: 132,
    fontWeight: '700',
    position: 'absolute',
  },
  patternSuitTop: {
    right: -22,
    top: 72,
    transform: [{ rotate: '14deg' }],
  },
  patternSuitMiddle: {
    left: -28,
    top: 318,
    transform: [{ rotate: '-18deg' }],
  },
  patternSuitBottom: {
    bottom: 74,
    right: 34,
    transform: [{ rotate: '-10deg' }],
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  hero: {
    alignItems: 'center',
    flex: 0.35,
    justifyContent: 'center',
    paddingTop: theme.spacing.xl,
  },
  logoShadow: {
    borderRadius: 39,
    elevation: 7,
    shadowColor: colors.accent,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.surfaceDeep,
    borderColor: 'rgba(217, 164, 65, 0.32)',
    borderRadius: 39,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  logoHeart: {
    marginTop: -9,
  },
  titleGroup: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    lineHeight: 23,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  actions: {
    flex: 0.45,
    justifyContent: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    elevation: 5,
    justifyContent: 'center',
    minHeight: 58,
    shadowColor: colors.accent,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  primaryButtonText: {
    color: '#17150F',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 107, 47, 0.5)',
    borderColor: 'rgba(217, 164, 65, 0.48)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    minHeight: 58,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  offlineButton: {
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  offlinePressed: {
    opacity: 0.72,
  },
  offlineText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  featureCard: {
    backgroundColor: 'rgba(47, 107, 47, 0.42)',
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: 24,
    borderWidth: 1,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
  },
  featureItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  featureIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(217, 164, 65, 0.12)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  featureText: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  featureDivider: {
    backgroundColor: 'rgba(245, 245, 245, 0.09)',
    height: 1,
    marginVertical: theme.spacing.md,
  },
  footer: {
    alignItems: 'center',
    flex: 0.2,
    justifyContent: 'flex-end',
    paddingBottom: theme.spacing.xl,
  },
  footerLine: {
    backgroundColor: 'rgba(245, 245, 245, 0.1)',
    height: 1,
    marginBottom: theme.spacing.lg,
    width: '42%',
  },
  footerText: {
    color: colors.softText,
    fontSize: 12,
  },
  versionText: {
    color: 'rgba(245, 245, 245, 0.28)',
    fontSize: 11,
    marginTop: theme.spacing.xs,
  },
});
