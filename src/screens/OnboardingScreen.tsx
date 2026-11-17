import { ArrowUpDown, Heart, Leaf, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardSuitIcon } from '../components/game/CardSuitIcon';
import { AppIcon } from '../components/ui/AppIcon';
import { AppText } from '../components/ui/AppText';
import { appVersion } from '../constants/appVersion';
import { legalLinks, openLegalLink } from '../constants/legal';
import type { AuthStackScreenProps } from '../navigation/types';
import { authColors, authTypography, theme } from '../theme';

type OnboardingScreenProps = AuthStackScreenProps<'Onboarding'>;

const colors = {
  background: authColors.background,
  surfaceDeep: authColors.surface,
  accent: authColors.gold,
  text: authColors.textPrimary,
  mutedText: 'rgba(245, 245, 245, 0.66)',
  softText: 'rgba(245, 245, 245, 0.42)',
};

export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  function continueOffline() {
    navigation.navigate('MainTabs');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundPattern} pointerEvents="none" aria-hidden>
        <View style={[styles.patternSuit, styles.patternSuitTop]}>
          <CardSuitIcon
            suit="herz"
            color="rgba(212, 175, 55, 0.06)"
            size={132}
          />
        </View>
        <View style={[styles.patternSuit, styles.patternSuitMiddle]}>
          <CardSuitIcon
            suit="eichel"
            color="rgba(212, 175, 55, 0.06)"
            size={132}
          />
        </View>
        <View style={[styles.patternSuit, styles.patternSuitBottom]}>
          <CardSuitIcon
            suit="herz"
            color="rgba(212, 175, 55, 0.06)"
            size={132}
          />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logoShadow}>
            <View style={styles.logo} aria-hidden>
              <AppIcon icon={Leaf} size="xl" color={colors.accent} />
              <AppIcon
                icon={Heart}
                size="md"
                color={colors.accent}
                style={styles.logoHeart}
              />
            </View>
          </View>

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

          <View style={styles.featureCard}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <AppIcon icon={Users} size="sm" color={colors.accent} />
              </View>
              <AppText style={styles.featureText}>Mit Freunden spielen</AppText>
            </View>

            <View style={styles.featureDivider} />

            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <AppIcon icon={ArrowUpDown} size="sm" color={colors.accent} />
              </View>
              <AppText style={styles.featureText}>
                Automatisch abrechnen
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          {legalLinks.length ? (
            <View style={styles.legalRow}>
              {legalLinks.map((link, index) => (
                <View key={link.key} style={styles.legalRow}>
                  {index > 0 ? (
                    <AppText style={styles.footerText}>·</AppText>
                  ) : null}
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={8}
                    onPress={() => void openLegalLink(link)}
                  >
                    <AppText style={[styles.footerText, styles.legalLink]}>
                      {link.title}
                    </AppText>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
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
    borderColor: 'rgba(212, 175, 55, 0.32)',
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
    fontSize: authTypography.title,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: authTypography.body,
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
    color: authColors.onGold,
    fontSize: authTypography.button,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: authColors.control,
    borderColor: 'rgba(212, 175, 55, 0.48)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    minHeight: 58,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: authTypography.button,
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
    fontSize: authTypography.body,
    fontWeight: '600',
  },
  featureCard: {
    backgroundColor: authColors.surfaceElevated,
    borderColor: authColors.borderSoft,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    shadowColor: authColors.shadow,
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
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  featureText: {
    color: colors.text,
    flex: 1,
    fontSize: authTypography.label,
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
  legalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
  footerText: {
    color: colors.softText,
    fontSize: authTypography.control,
  },
  versionText: {
    color: 'rgba(245, 245, 245, 0.28)',
    fontSize: authTypography.tiny,
    marginTop: theme.spacing.xs,
  },
});
