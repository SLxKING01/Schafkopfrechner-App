import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import type { AnimalAvatarId } from '../../types/profile';
import { AnimalAvatar } from '../game/AnimalAvatar';

type AvatarGridItemProps = {
  accentColor: string;
  avatarId: AnimalAvatarId;
  isSelected: boolean;
  size: number;
  onSelect: (avatarId: AnimalAvatarId) => void;
};

export function AvatarGridItem({
  accentColor,
  avatarId,
  isSelected,
  size,
  onSelect,
}: AvatarGridItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, { width: size }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSelect(avatarId)}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 16, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(isSelected ? 1.04 : 1, {
            damping: 15,
            stiffness: 230,
          });
        }}
        style={({ pressed }) => [
          styles.tile,
          isSelected && styles.tileSelected,
          pressed && styles.tilePressed,
        ]}
      >
        <View
          style={[
            styles.glow,
            isSelected && { backgroundColor: accentColor, opacity: 0.28 },
          ]}
        />
        <AnimalAvatar
          accentColor={accentColor}
          animalId={avatarId}
          highlighted={isSelected}
          size={58}
        />
        {isSelected ? (
          <View style={styles.check}>
            <Check color="#17150B" size={13} strokeWidth={3} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: 'rgba(13, 27, 19, 0.74)',
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: authRadius.xl,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: authColors.shadow,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  tileSelected: {
    borderColor: authColors.goldHighlight,
    borderWidth: 2,
    elevation: 8,
    shadowColor: authColors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 24,
  },
  tilePressed: {
    backgroundColor: 'rgba(245, 245, 245, 0.04)',
  },
  glow: {
    borderRadius: authRadius.pill,
    height: 72,
    opacity: 0,
    position: 'absolute',
    width: 72,
  },
  check: {
    alignItems: 'center',
    backgroundColor: authColors.goldHighlight,
    borderRadius: authRadius.pill,
    bottom: authSpacing.sm,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: authSpacing.sm,
    width: 22,
  },
});
