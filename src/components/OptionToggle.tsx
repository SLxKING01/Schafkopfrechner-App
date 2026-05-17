import { Pressable, StyleSheet } from 'react-native';

import { theme } from '../constants/theme';
import { AppText } from './ui/AppText';

type OptionToggleProps = {
  title: string;
  isActive: boolean;
  onPress: () => void;
};

export function OptionToggle({ title, isActive, onPress }: OptionToggleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggle,
        isActive && styles.activeToggle,
        pressed && styles.pressed,
      ]}
    >
      <AppText
        variant="subtitle"
        style={isActive ? styles.activeText : undefined}
      >
        {title}
      </AppText>
      <AppText
        variant="caption"
        style={isActive ? styles.activeText : undefined}
      >
        {isActive ? 'Aktiv' : 'Aus'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flex: 1,
    gap: theme.spacing.xs,
    minHeight: 72,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  activeToggle: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  activeText: {
    color: theme.colors.primaryText,
  },
  pressed: {
    opacity: 0.85,
  },
});
