import Constants from 'expo-constants';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardSuitIcon } from '../components/game/CardSuitIcon';
import { AppLogo } from '../components/ui/AppLogo';
import { AppText } from '../components/ui/AppText';
import { theme } from '../constants/theme';
import type { AuthStackScreenProps } from '../navigation/types';
import { useGuestModeStore } from '../store/guestModeStore';

type OnboardingScreenProps = AuthStackScreenProps<'Onboarding'>;

const appVersion = Constants.expoConfig?.version;

const colors = {
  background: '#161816',
  surface: '#2F6B2F',
  accent: '#D9A441',
  text: '#F5F5F5',
  mutedText: 'rgba(245, 245, 245, 0.66)',
  softText: 'rgba(245, 245, 245, 0.42)',
  positive: '#5BBE63',
  negative: '#D65A5A',
};

export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const enableGuestMode = useGuestModeStore((state) => state.setEnabled);

  function continueOffline() {
    enableGuestMode(true);
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundPattern} pointerEvents="none" aria-hidden>
        <View style={[styles.patternSuit, styles.patternSuitTop]}>
          <CardSuitIcon
            suit="herz"
            color="rgba(217, 164, 65, 0.06)"
            size={132}
          />
        </View>
        <View style={[styles.patternSuit, styles.patternSuitBottom]}>
          <CardSuitIcon
            suit="herz"
            color="rgba(217, 164, 65, 0.06)"
            size={132}
          />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <AppLogo />

          <View style={styles.titleGroup}>
            <AppText accessibilityRole="header" style={styles.title}>
              Schafkopfrechner
            </AppText>
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
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <View style={styles.legalLinks}>
            <Pressable
              accessibilityRole="link"
              hitSlop={10}
              onPress={() => navigation.navigate('Legal', { page: 'privacy' })}
            >
              <AppText style={styles.footerLink}>Datenschutz</AppText>
            </Pressable>
            <AppText style={styles.footerText}>·</AppText>
            <Pressable
              accessibilityRole="link"
              hitSlop={10}
              onPress={() => navigation.navigate('Legal', { page: 'imprint' })}
            >
              <AppText style={styles.footerLink}>Impressum</AppText>
            </Pressable>
          </View>
          {appVersion ? (
            <AppText style={styles.versionText}>Version {appVersion}</AppText>
          ) : null}
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
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  patternSuit: {
    position: 'absolute',
  },
  patternSuitTop: {
    right: -22,
    top: 72,
    transform: [{ rotate: '14deg' }],
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
  legalLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  footerLink: {
    color: colors.mutedText,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  footerText: {
    color: colors.softText,
    fontSize: 13,
  },
  versionText: {
    color: 'rgba(245, 245, 245, 0.28)',
    fontSize: 11,
    marginTop: theme.spacing.xs,
  },
});
