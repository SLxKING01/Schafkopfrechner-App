import { Pressable, StyleSheet } from 'react-native';

import { theme } from '../constants/theme';
import { AppText } from './ui/AppText';

type PlayerChipProps = {
  name: string;
  isSelected: boolean;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger';
};

export function PlayerChip({
  name,
  isSelected,
  onPress,
  disabled = false,
  variant = 'primary',
}: PlayerChipProps) {
  const selectedStyle =
    variant === 'danger' ? styles.selectedDanger : styles.selectedPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        isSelected && selectedStyle,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <AppText
        style={[
          styles.text,
          isSelected ? styles.selectedText : undefined,
          disabled ? styles.disabledText : undefined,
        ]}
      >
        {name}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 104,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  selectedPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectedDanger: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontWeight: '600',
  },
  selectedText: {
    color: theme.colors.primaryText,
  },
  disabledText: {
    color: theme.colors.textMuted,
  },
});
