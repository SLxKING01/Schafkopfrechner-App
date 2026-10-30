import { Minus, Plus, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';

import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { FriendProfile } from '../../types/profile';
import { AppText } from '../ui/AppText';
import { AnimalAvatar } from './AnimalAvatar';

type FriendPickerSheetProps = {
  friends: FriendProfile[];
  maxPlayersReached?: boolean;
  selectedFriendIds: string[];
  visible: boolean;
  onClose: () => void;
  onToggleFriend: (friend: FriendProfile) => void;
};

const colors = {
  card: '#1A2D24',
  gold: '#E7C65C',
  input: '#10241C',
  muted: 'rgba(245, 245, 245, 0.62)',
  soft: 'rgba(245, 245, 245, 0.36)',
  text: '#F5F5F5',
};

export function FriendPickerSheet({
  friends,
  maxPlayersReached = false,
  selectedFriendIds,
  visible,
  onClose,
  onToggleFriend,
}: FriendPickerSheetProps) {
  const [query, setQuery] = useState('');
  const selectedFriendIdSet = useMemo(
    () => new Set(selectedFriendIds),
    [selectedFriendIds],
  );

  const filteredFriends = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return friends;
    }

    return friends.filter((friend) =>
      friend.username.toLowerCase().includes(search),
    );
  }, [friends, query]);

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          style={styles.backdrop}
        >
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(210)}
          exiting={SlideOutDown.duration(180)}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <AppText style={styles.title}>Freunde hinzufügen</AppText>
              <AppText style={styles.subtitle}>
                Wähle Freunde für diesen Tisch aus.
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <X color={colors.gold} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search color={colors.soft} size={18} />
            <TextInput
              keyboardAppearance="dark"
              onChangeText={setQuery}
              placeholder="Freunde suchen"
              placeholderTextColor={colors.soft}
              selectionColor={colors.gold}
              style={styles.searchInput}
              value={query}
            />
          </View>

          <FlatList
            contentContainerStyle={styles.listContent}
            data={filteredFriends}
            keyExtractor={(friend) => friend.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selectedFriendIdSet.has(item.id);
              const isDisabled = maxPlayersReached && !isSelected;

              return (
                <Pressable
                  accessibilityLabel={`${item.username} ${
                    isSelected ? 'entfernen' : 'hinzufuegen'
                  }`}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: isDisabled,
                    selected: isSelected,
                  }}
                  disabled={isDisabled}
                  onPress={() => onToggleFriend(item)}
                  style={({ pressed }) => [
                    styles.friendRow,
                    isSelected && {
                      borderColor: item.accentColor,
                      shadowColor: item.accentColor,
                    },
                    isDisabled && styles.friendRowDisabled,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View>
                    <AnimalAvatar
                      accentColor={item.accentColor}
                      animalId={item.avatarId}
                      highlighted={isSelected}
                      size={50}
                    />
                    {item.isOnline ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <View style={styles.friendBody}>
                    <Text numberOfLines={1} style={styles.friendName}>
                      {item.username}
                    </Text>
                    <AppText style={styles.friendMeta}>
                      {item.isOnline ? 'Gerade online' : 'Stammtisch-Freund'}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.toggleButton,
                      isSelected && { backgroundColor: item.accentColor },
                      isDisabled && styles.toggleButtonDisabled,
                    ]}
                  >
                    {isSelected ? (
                      <Minus color="#17150B" size={18} strokeWidth={3} />
                    ) : (
                      <Plus
                        color={
                          isDisabled ? 'rgba(245, 245, 245, 0.36)' : colors.gold
                        }
                        size={18}
                        strokeWidth={2.8}
                      />
                    )}
                  </View>
                </Pressable>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderColor: 'rgba(231, 198, 92, 0.18)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    maxHeight: '82%',
    paddingBottom: 28,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.md,
    shadowColor: '#000000',
    shadowOffset: { height: -12, width: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.18)',
    borderRadius: authRadius.pill,
    height: 5,
    marginBottom: authSpacing.md,
    width: 48,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: authTypography.caption,
    marginTop: authSpacing.xs,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.07)',
    borderRadius: authRadius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: 'rgba(231, 198, 92, 0.18)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.sm,
    marginTop: authSpacing.lg,
    minHeight: 54,
    paddingHorizontal: authSpacing.lg,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    gap: authSpacing.sm,
    paddingTop: authSpacing.lg,
  },
  friendRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 36, 28, 0.72)',
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.md,
    minHeight: 78,
    padding: authSpacing.md,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  rowPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  friendRowDisabled: {
    opacity: 0.45,
  },
  onlineDot: {
    backgroundColor: '#5BBE63',
    borderColor: colors.card,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 1,
    height: 13,
    position: 'absolute',
    right: 1,
    width: 13,
  },
  friendBody: {
    flex: 1,
  },
  friendName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  friendMeta: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  toggleButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(231, 198, 92, 0.12)',
    borderRadius: authRadius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  toggleButtonDisabled: {
    backgroundColor: 'rgba(245, 245, 245, 0.08)',
  },
});
