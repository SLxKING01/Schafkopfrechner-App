import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { authControlSizes, authShadows, authTextStyles } from '../../theme';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { AppText } from '../ui/AppText';

type GoldButtonProps = {
  title: string;
  onPress: () => void;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  style?: ViewStyle;
};

export function GoldButton({
  title,
  onPress,
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  icon,
  loading = false,
  style,
}: GoldButtonProps) {
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReducedMotion();
  const blocked = disabled || loading;

  return (
    <Animated.View
      style={[
        styles.feedback,
        {
          transitionProperty: ['transform', 'opacity'],
          transitionDuration: reduceMotion ? 0 : 120,
          transitionTimingFunction: 'ease-out',
        },
        pressed && !blocked && styles.pressed,
        pressed && !blocked && !reduceMotion && styles.pressedScale,
        blocked && styles.disabledContainer,
        style,
      ]}
    >
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <LinearGradient
          colors={[authColors.goldHighlight, authColors.gold, '#B88920']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {loading ? <ActivityIndicator color="#17150B" size="small" /> : icon}
          <AppText style={styles.text}>{title}</AppText>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  feedback: {
    transform: [{ scale: 1 }],
  },
  pressed: { opacity: 0.88 },
  pressedScale: { transform: [{ scale: 0.985 }] },
  button: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    ...authShadows.gold,
    flexDirection: 'row',
    gap: authSpacing.sm,
    justifyContent: 'center',
    minHeight: authControlSizes.primaryButton,
    paddingHorizontal: authSpacing.xl,
  },
  disabledContainer: {
    opacity: 0.68,
  },
  text: {
    ...authTextStyles.button,
    color: authColors.onGold,
  },
});
