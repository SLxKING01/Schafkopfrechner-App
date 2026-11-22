import type { LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppIcon } from '../ui/AppIcon';
import { AppText } from '../ui/AppText';

type SocialButtonProps = {
  title: string;
  icon: ComponentType<LucideProps>;
  onPress: () => void;
};

export function SocialButton({
  title,
  icon: Icon,
  onPress,
}: SocialButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <AppIcon icon={Icon} size="md" color={authColors.textPrimary} />
      <AppText style={styles.text}>{title}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.74)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: authSpacing.sm,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: authSpacing.md,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: authColors.textPrimary,
    fontSize: authTypography.label,
    fontWeight: '700',
  },
});
