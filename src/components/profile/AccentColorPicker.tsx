import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PROFILE_ACCENTS } from '../../constants/profileCustomization';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { ProfileAccentId } from '../../types/profile';
import { AppText } from '../ui/AppText';

type AccentColorPickerProps = {
  selectedAccentId: ProfileAccentId;
  onSelect: (accentId: ProfileAccentId) => void;
};

export function AccentColorPicker({
  selectedAccentId,
  onSelect,
}: AccentColorPickerProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText style={styles.title}>Accent Color</AppText>
        <AppText style={styles.hint}>Live Preview</AppText>
      </View>
      <View style={styles.row}>
        {(Object.keys(PROFILE_ACCENTS) as ProfileAccentId[]).map((accentId) => (
          <AccentChip
            key={accentId}
            accentId={accentId}
            isSelected={accentId === selectedAccentId}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

type AccentChipProps = {
  accentId: ProfileAccentId;
  isSelected: boolean;
  onSelect: (accentId: ProfileAccentId) => void;
};

function AccentChip({ accentId, isSelected, onSelect }: AccentChipProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSelect(accentId)}
        onPressIn={() => {
          scale.value = withSpring(0.92, { damping: 16, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 230 });
        }}
        style={[
          styles.chipWrap,
          isSelected && styles.chipWrapSelected,
          {
            borderColor: isSelected ? authColors.goldHighlight : 'transparent',
          },
        ]}
      >
        <View
          style={[
            styles.chip,
            {
              backgroundColor: PROFILE_ACCENTS[accentId],
              shadowColor: PROFILE_ACCENTS[accentId],
            },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: authSpacing.md,
    paddingTop: authSpacing.lg,
  },
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '900',
  },
  hint: {
    color: authColors.textSecondary,
    fontSize: authTypography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
  chipWrap: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    borderWidth: 2,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  chipWrapSelected: {
    backgroundColor: 'rgba(242, 201, 76, 0.09)',
  },
  chip: {
    borderColor: 'rgba(245, 245, 245, 0.22)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    height: 28,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    width: 28,
  },
});
