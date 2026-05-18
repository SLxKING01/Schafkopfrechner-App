import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authRadius, authSpacing } from '../../theme/spacing';
import type { FriendProfile } from '../../types/profile';
import { AppText } from '../ui/AppText';
import { AnimalAvatar } from './AnimalAvatar';

type FriendChipProps = {
  friend: FriendProfile;
  isSelected: boolean;
  onPress: (friend: FriendProfile) => void;
};

export function FriendChip({ friend, isSelected, onPress }: FriendChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(friend)}
      style={({ pressed }) => [
        styles.card,
        isSelected && {
          borderColor: friend.accentColor,
          shadowColor: friend.accentColor,
        },
        pressed && styles.pressed,
      ]}
    >
      <View>
        <AnimalAvatar
          accentColor={friend.accentColor}
          animalId={friend.avatarId}
          highlighted={isSelected}
          size={48}
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
        ]}
      >
        <Plus color={isSelected ? '#17150B' : '#E7C65C'} size={14} />
      </View>
      <AppText style={styles.caption}>{isSelected ? 'Dabei' : 'Add'}</AppText>
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
    shadowColor: '#000000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    width: 92,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
  onlineDot: {
    backgroundColor: '#5BBE63',
    borderColor: '#1A2D24',
    borderRadius: 999,
    borderWidth: 2,
    bottom: 1,
    height: 13,
    position: 'absolute',
    right: 1,
    width: 13,
  },
  name: {
    color: '#F5F5F5',
    fontSize: 13,
    fontWeight: '900',
    maxWidth: 72,
  },
  addBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(231, 198, 92, 0.12)',
    borderRadius: authRadius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  caption: {
    color: 'rgba(245, 245, 245, 0.46)',
    fontSize: 10,
    fontWeight: '800',
  },
});
