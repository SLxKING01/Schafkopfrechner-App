import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authColors } from '../../theme/colors';
import { AppText } from '../ui/AppText';

type AuthBackgroundProps = {
  children: ReactNode;
  withSafeArea?: boolean;
};

export function AuthBackground({
  children,
  withSafeArea = true,
}: AuthBackgroundProps) {
  // Full-screen sheets already apply their own safe-area insets.
  const Content = withSafeArea ? SafeAreaView : View;
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[
          authColors.background,
          authColors.backgroundSoft,
          authColors.background,
        ]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.vignette} pointerEvents="none" />
      <View style={styles.patternLayer} pointerEvents="none">
        <AppText style={[styles.patternSuit, styles.patternTop]}>{'♥'}</AppText>
        <AppText style={[styles.patternSuit, styles.patternMiddle]}>
          {'♣'}
        </AppText>
        <AppText style={[styles.patternSuit, styles.patternBottom]}>
          {'♦'}
        </AppText>
      </View>
      <BlurView
        pointerEvents="none"
        intensity={12}
        tint="dark"
        style={styles.blurWash}
      />
      <Content style={styles.safeArea}>{children}</Content>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: authColors.background,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 18,
  },
  patternLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  patternSuit: {
    color: 'rgba(212, 175, 55, 0.055)',
    fontSize: 150,
    fontWeight: '700',
    position: 'absolute',
  },
  patternTop: {
    right: -22,
    top: 66,
    transform: [{ rotate: '11deg' }],
  },
  patternMiddle: {
    left: -30,
    top: 346,
    transform: [{ rotate: '-17deg' }],
  },
  patternBottom: {
    bottom: 62,
    right: 18,
    transform: [{ rotate: '-9deg' }],
  },
  blurWash: {
    ...StyleSheet.absoluteFill,
    opacity: 0.3,
  },
});
