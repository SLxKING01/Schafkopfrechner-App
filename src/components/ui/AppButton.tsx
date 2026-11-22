import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { authColors, authControlSizes, theme } from '../../theme';
import { AppText } from './AppText';

type AppButtonVariant = 'primary' | 'secondary' | 'danger';

type AppButtonProps = {
  title: string;
  onPress: PressableProps['onPress'];
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'secondary'
              ? theme.colors.secondaryText
              : variant === 'danger'
                ? authColors.errorText
                : theme.colors.primaryText
          }
        />
      ) : null}
      <AppText
        style={[
          styles.text,
          variant === 'secondary' ? styles.secondaryText : undefined,
          variant === 'danger' ? styles.dangerText : undefined,
          disabled ? styles.disabledText : undefined,
        ]}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: authControlSizes.touch,
    borderCurve: 'continuous',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  // Secondary and danger actions are outlined so the gold primary stays the
  // single most prominent action on a screen.
  secondary: {
    backgroundColor: theme.colors.secondary,
    borderColor: authColors.borderGold,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: authColors.errorBackground,
    borderColor: authColors.errorBorder,
    borderWidth: 1,
  },
  disabled: {
    backgroundColor: theme.colors.disabled,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: theme.colors.primaryText,
    fontWeight: '600',
  },
  secondaryText: {
    color: theme.colors.secondaryText,
  },
  dangerText: { color: authColors.errorText },
  disabledText: {
    color: theme.colors.disabledText,
  },
});
