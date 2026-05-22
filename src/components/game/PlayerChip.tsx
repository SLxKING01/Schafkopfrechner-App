import { X } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type PlayerChipProps = {
  name: string;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  selected?: boolean;
  removable?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
};

export const PlayerChip = memo(function PlayerChip({
  name,
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  selected = false,
  removable = false,
  onPress,
  onRemove,
}: PlayerChipProps) {
  return (
    <Animated.View entering={FadeIn.duration(220)} layout={Layout.springify()}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel ?? name}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.chip,
          selected && styles.selected,
          disabled && styles.disabled,
        ]}
      >
        <AppText style={[styles.text, selected && styles.selectedText]}>
          {name}
        </AppText>
        {removable ? (
          <Pressable
            accessibilityLabel={`${name} entfernen`}
            accessibilityRole="button"
            onPress={onRemove}
            style={styles.remove}
          >
            <X color={authColors.textPrimary} size={13} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.76)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.sm,
    minHeight: 44,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  selected: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderColor: authColors.gold,
  },
  disabled: {
    opacity: 0.42,
  },
  text: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    fontWeight: '800',
  },
  selectedText: {
    color: authColors.goldHighlight,
  },
  remove: {
    backgroundColor: 'rgba(245, 245, 245, 0.1)',
    borderRadius: 10,
    padding: 3,
  },
});
