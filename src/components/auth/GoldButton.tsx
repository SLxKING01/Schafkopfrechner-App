import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[animatedStyle, disabled && styles.disabledContainer, style]}
    >
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          if (disabled) {
            return;
          }

          scale.value = withSpring(0.975, { damping: 18, stiffness: 280 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 280 });
        }}
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
  button: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    elevation: 8,
    flexDirection: 'row',
    gap: authSpacing.sm,
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: authSpacing.xl,
    shadowColor: authColors.gold,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  disabledContainer: {
    opacity: 0.68,
  },
  text: {
    color: '#17150B',
    fontSize: 17,
    fontWeight: '800',
  },
});
