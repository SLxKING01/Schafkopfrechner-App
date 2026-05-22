import BottomSheet, {
  type BottomSheetBackdropProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import type { RefObject } from 'react';
import { useCallback, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  ANIMAL_AVATAR_IDS,
  PROFILE_ACCENTS,
} from '../../constants/profileCustomization';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { AnimalAvatarId, ProfileAccentId } from '../../types/profile';
import { AppText } from '../ui/AppText';
import { AccentColorPicker } from './AccentColorPicker';
import { AvatarGridItem } from './AvatarGridItem';

type AvatarPickerSheetProps = {
  accentId: ProfileAccentId;
  avatarId: AnimalAvatarId;
  sheetRef: RefObject<BottomSheet | null>;
  onClose: () => void;
  onDismiss: () => void;
  onSelectAccent: (accentId: ProfileAccentId) => void;
  onSelectAvatar: (avatarId: AnimalAvatarId) => void;
};

export function AvatarPickerSheet({
  accentId,
  avatarId,
  sheetRef,
  onClose,
  onDismiss,
  onSelectAccent,
  onSelectAvatar,
}: AvatarPickerSheetProps) {
  const { width } = useWindowDimensions();
  const snapPoints = useMemo(() => ['40%', '75%'], []);
  const accentColor = PROFILE_ACCENTS[accentId];
  const columns = width >= 430 ? 4 : 3;
  const gridGap = authSpacing.md;
  const contentWidth = Math.min(width - authSpacing.xl * 2, 520);
  const itemSize = Math.min(
    108,
    Math.floor((contentWidth - gridGap * (columns - 1)) / columns),
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <AvatarPickerBackdrop {...props} onPress={onClose} />
    ),
    [onClose],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      enablePanDownToClose
      handleIndicatorStyle={styles.handle}
      index={-1}
      snapPoints={snapPoints}
      onClose={onDismiss}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppText style={styles.kicker}>Profil-Look</AppText>
          <AppText style={styles.title}>Avatar auswählen</AppText>
          <AppText style={styles.subtitle}>
            Wähle deinen Auftritt am Tisch. Die Vorschau aktualisiert sich
            sofort.
          </AppText>
        </View>

        <View style={[styles.grid, { gap: gridGap }]}>
          {ANIMAL_AVATAR_IDS.map((option) => (
            <AvatarGridItem
              key={option}
              accentColor={accentColor}
              avatarId={option}
              isSelected={avatarId === option}
              size={itemSize}
              onSelect={onSelectAvatar}
            />
          ))}
        </View>

        <AccentColorPicker
          selectedAccentId={accentId}
          onSelect={onSelectAccent}
        />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

type AvatarPickerBackdropProps = BottomSheetBackdropProps & {
  onPress: () => void;
};

function AvatarPickerBackdrop({
  animatedIndex,
  onPress,
  style,
}: AvatarPickerBackdropProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Animated.View style={[style, styles.backdrop, animatedStyle]}>
      {Platform.OS === 'web' ? null : (
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  sheetBackground: {
    backgroundColor: '#0B1D16',
    borderColor: 'rgba(242, 201, 76, 0.22)',
    borderTopLeftRadius: authRadius.xl,
    borderTopRightRadius: authRadius.xl,
    borderWidth: 1,
  },
  handle: {
    backgroundColor: 'rgba(242, 201, 76, 0.52)',
    width: 46,
  },
  content: {
    gap: authSpacing.lg,
    paddingBottom: 44,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.sm,
  },
  header: {
    gap: authSpacing.xs,
  },
  kicker: {
    color: authColors.goldHighlight,
    fontSize: authTypography.tiny,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
