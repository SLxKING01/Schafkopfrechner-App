import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { FriendProfile } from '../../types/profile';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { AppIcon } from '../ui/AppIcon';
import { AppText } from '../ui/AppText';

type FriendChipProps = {
  friend: FriendProfile;
  isDisabled?: boolean;
  isSelected: boolean;
  onPress: (friend: FriendProfile) => void;
};

export function FriendChip({
  friend,
  isDisabled = false,
  isSelected,
  onPress,
}: FriendChipProps) {
  const actionLabel = isSelected ? 'entfernen' : 'hinzufuegen';

  return (
    <Pressable
      accessibilityLabel={`${friend.username} ${actionLabel}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, selected: isSelected }}
      disabled={isDisabled}
      onPress={() => onPress(friend)}
      style={({ pressed }) => [
        styles.card,
        isSelected && {
          borderColor: friend.accentColor,
          shadowColor: friend.accentColor,
        },
        isDisabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <ProfileAvatar
          size={48}
          profile={{
            avatarKind: friend.avatarKind ?? 'animal',
            animalId: friend.avatarId,
            accentId: friend.accentId ?? 'forestGreen',
            photoPath: friend.photoPath ?? null,
          }}
        />
        {friend.isOnline ? <View style={styles.onlineDot} /> : null}
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {friend.username}
      </Text>
      <View
        style={[
          styles.addBadge,
          isSelected && { backgroundColor: friend.accentColor },
          isDisabled && styles.addBadgeDisabled,
        ]}
      >
        {isSelected ? (
          <AppIcon
            icon={Minus}
            size="xs"
            weight="strong"
            color={authColors.onGold}
          />
        ) : (
          <AppIcon
            icon={Plus}
            size="xs"
            weight="strong"
            color={isDisabled ? authColors.textFaint : authColors.goldHighlight}
          />
        )}
      </View>
      <AppText style={[styles.caption, isSelected && styles.captionSelected]}>
        {isSelected ? 'Entfernen' : 'Add'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(32, 55, 45, 0.9)',
    borderColor: 'rgba(245, 245, 245, 0.09)',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 5,
    gap: authSpacing.xs,
    minHeight: 124,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.md,
    shadowColor: authColors.shadow,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    width: 92,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.42,
  },
  onlineDot: {
    backgroundColor: authColors.accentGreen,
    borderColor: authColors.tableCard,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 1,
    height: 13,
    position: 'absolute',
    right: 1,
    width: 13,
  },
  name: {
    color: authColors.textPrimary,
    fontSize: authTypography.caption,
    fontWeight: '900',
    maxWidth: 72,
  },
  addBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(242, 201, 76, 0.12)',
    borderRadius: authRadius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  addBadgeDisabled: {
    backgroundColor: authColors.borderSoft,
  },
  caption: {
    color: 'rgba(245, 245, 245, 0.46)',
    fontSize: authTypography.micro,
    fontWeight: '800',
  },
  captionSelected: {
    color: authColors.goldHighlight,
  },
});
