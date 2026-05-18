import type { LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { authColors } from '../../theme/colors';
import { authShadows } from '../../theme/shadows';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type QuickActionCardProps = {
  title: string;
  subtitle: string;
  icon: ComponentType<LucideProps>;
  onPress: () => void;
};

export function QuickActionCard({
  title,
  subtitle,
  icon: Icon,
  onPress,
}: QuickActionCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 260 });
        }}
        style={styles.card}
      >
        <Icon color={authColors.goldHighlight} size={24} strokeWidth={2} />
        <AppText style={styles.title}>{title}</AppText>
        <AppText style={styles.subtitle}>{subtitle}</AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: '47%',
  },
  card: {
    ...authShadows.card,
    backgroundColor: 'rgba(13, 27, 19, 0.82)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    minHeight: 132,
    padding: authSpacing.lg,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '800',
    marginTop: authSpacing.lg,
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    lineHeight: 18,
    marginTop: authSpacing.xs,
  },
});
