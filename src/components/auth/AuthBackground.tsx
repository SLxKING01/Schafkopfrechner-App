import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authColors } from '../../theme/colors';

type AuthBackgroundProps = {
  children: ReactNode;
  withSafeArea?: boolean;
  backgroundPattern?: ReactNode;
  withEdgeBorder?: boolean;
};

export function AuthBackground({
  children,
  withSafeArea = true,
  backgroundPattern,
  withEdgeBorder = true,
}: AuthBackgroundProps) {
  // Disable when the surrounding layout already applies safe-area insets.
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
      <View
        style={[styles.vignette, withEdgeBorder && styles.edgeBorder]}
        pointerEvents="none"
      />
      {backgroundPattern ? (
        <View style={styles.patternLayer} pointerEvents="none" aria-hidden>
          {backgroundPattern}
        </View>
      ) : null}
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
  },
  edgeBorder: {
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 18,
  },
  patternLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  blurWash: {
    ...StyleSheet.absoluteFill,
    opacity: 0.3,
  },
});
