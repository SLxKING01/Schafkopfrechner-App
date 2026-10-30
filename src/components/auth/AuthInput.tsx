import { Eye, EyeOff, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';

type AuthInputProps = TextInputProps & {
  icon: ComponentType<LucideProps>;
  hasError?: boolean;
  isPassword?: boolean;
};

export function AuthInput({
  hasError = false,
  icon: Icon,
  isPassword = false,
  onBlur,
  onFocus,
  secureTextEntry,
  ...props
}: AuthInputProps) {
  const [isHidden, setIsHidden] = useState(isPassword);
  const error = useSharedValue(hasError ? 1 : 0);
  const focus = useSharedValue(0);

  useEffect(() => {
    error.value = withTiming(hasError ? 1 : 0, { duration: 180 });
  }, [error, hasError]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor:
      error.value > 0
        ? authColors.errorBorder
        : interpolateColor(
            focus.value,
            [0, 1],
            [authColors.borderGold, authColors.inputFocused],
          ),
    shadowColor: interpolateColor(
      error.value,
      [0, 1],
      [authColors.gold, authColors.error],
    ),
    shadowOpacity: 0.1 + focus.value * 0.16 + error.value * 0.08,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Icon color={authColors.gold} size={20} strokeWidth={1.9} />
      <TextInput
        {...props}
        placeholderTextColor="rgba(161, 161, 161, 0.76)"
        secureTextEntry={isPassword ? isHidden : secureTextEntry}
        selectionColor={authColors.goldHighlight}
        style={styles.input}
        onBlur={(event) => {
          focus.value = withTiming(0, { duration: 180 });
          onBlur?.(event);
        }}
        onFocus={(event) => {
          focus.value = withTiming(1, { duration: 180 });
          onFocus?.(event);
        }}
      />
      {isPassword ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsHidden((value) => !value)}
          style={styles.visibilityButton}
        >
          {isHidden ? (
            <Eye color={authColors.textSecondary} size={19} strokeWidth={1.8} />
          ) : (
            <EyeOff
              color={authColors.textSecondary}
              size={19}
              strokeWidth={1.8}
            />
          )}
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: authColors.inputFill,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: authSpacing.lg,
    shadowColor: authColors.gold,
    shadowOffset: { height: 7, width: 0 },
    shadowRadius: 14,
  },
  input: {
    color: authColors.textPrimary,
    flex: 1,
    fontSize: 16,
    marginLeft: authSpacing.md,
    paddingVertical: authSpacing.md,
  },
  visibilityButton: {
    marginLeft: authSpacing.sm,
    padding: authSpacing.xs,
  },
});
