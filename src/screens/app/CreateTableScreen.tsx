import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Plus, Spade, UserPlus, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AnimalAvatar } from '../../components/game/AnimalAvatar';
import { FriendChip } from '../../components/game/FriendChip';
import { FriendPickerSheet } from '../../components/game/FriendPickerSheet';
import { AppText } from '../../components/ui/AppText';
import {
  DEFAULT_USER_APPEARANCE,
  FRIEND_PREVIEWS,
} from '../../constants/profileCustomization';
import type { AppStackScreenProps } from '../../navigation/types';
import { createLocalPlayer } from '../../services/game/addPlayer';
import { useGameStore } from '../../store/gameStore';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { Player } from '../../types/game';
import type { AnimalAvatarId, FriendProfile } from '../../types/profile';

type CreateTableScreenProps = AppStackScreenProps<'CreateTable'>;

type TablePlayer = Player & {
  accentColor: string;
  animalId: AnimalAvatarId;
  friendId?: string;
  isCurrentUser?: boolean;
};

const screenColors = {
  background: '#0B1D16',
  backgroundMid: '#10241C',
  backgroundSoft: '#163328',
  card: '#1A2D24',
  cardElevated: '#20372D',
  input: '#10241C',
  gold: '#E7C65C',
  text: '#F5F5F5',
  muted: 'rgba(245, 245, 245, 0.62)',
  soft: 'rgba(245, 245, 245, 0.36)',
  border: 'rgba(231, 198, 92, 0.24)',
  greenBorder: 'rgba(111, 169, 114, 0.2)',
  shadow: '#000000',
};

const maxPlayers = 8;

export function CreateTableScreen({ navigation }: CreateTableScreenProps) {
  const [tableName, setTableName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<TablePlayer[]>([]);
  const [friendPickerVisible, setFriendPickerVisible] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'table' | 'player' | null>(
    null,
  );
  const createTable = useGameStore((state) => state.createTable);

  const canAddPlayer =
    playerName.trim().length > 0 && players.length < maxPlayers;
  const canCreateTable = tableName.trim().length > 0 && players.length >= 2;
  const selectedFriendIds = useMemo(
    () =>
      players
        .map((player) => player.friendId)
        .filter((friendId): friendId is string => Boolean(friendId)),
    [players],
  );
  const selectedFriendIdSet = useMemo(
    () => new Set(selectedFriendIds),
    [selectedFriendIds],
  );
  const hasReachedMaxPlayers = players.length >= maxPlayers;

  function addPlayer() {
    const nextName = playerName.trim();

    if (!nextName) {
      return;
    }

    let didAdd = false;
    let didHitDuplicate = false;

    setPlayers((currentPlayers) => {
      if (currentPlayers.length >= maxPlayers) {
        return currentPlayers;
      }

      const exists = currentPlayers.some(
        (player) => player.name.trim().toLowerCase() === nextName.toLowerCase(),
      );

      if (exists) {
        didHitDuplicate = true;
        return currentPlayers;
      }

      didAdd = true;

      return [
        ...currentPlayers,
        {
          ...createLocalPlayer(nextName),
          accentColor: getManualPlayerAccent(currentPlayers.length),
          animalId: getManualPlayerAnimal(currentPlayers.length),
          isCurrentUser: currentPlayers.length === 0,
        },
      ];
    });

    if (didHitDuplicate) {
      Alert.alert(
        'Name bereits vorhanden',
        'Dieser Spieler ist schon am Tisch.',
      );
    }

    if (didAdd) {
      setPlayerName('');
    }
  }

  const toggleFriend = useCallback((friend: FriendProfile) => {
    setPlayers((currentPlayers) => {
      const existingFriendPlayer = currentPlayers.find(
        (player) => player.friendId === friend.id,
      );

      if (existingFriendPlayer) {
        return currentPlayers.filter(
          (player) => player.id !== existingFriendPlayer.id,
        );
      }

      const existsByName = currentPlayers.some(
        (player) =>
          player.name.trim().toLowerCase() ===
          friend.username.trim().toLowerCase(),
      );

      if (existsByName || currentPlayers.length >= maxPlayers) {
        return currentPlayers;
      }

      return [
        ...currentPlayers,
        {
          ...createLocalPlayer(friend.username),
          accentColor: friend.accentColor,
          animalId: friend.avatarId,
          friendId: friend.id,
        },
      ];
    });
  }, []);

  function removePlayer(id: string) {
    setPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== id),
    );
  }

  function startGame() {
    const didCreate = createTable(tableName, players);

    if (!didCreate) {
      Alert.alert(
        'Tisch nicht bereit',
        'Bitte gib einen Tischnamen ein und füge mindestens zwei Spieler hinzu.',
      );
      return;
    }

    navigation.replace('ActiveGame');
  }

  return (
    <AuthBackground>
      <LinearGradient
        colors={[
          screenColors.background,
          screenColors.backgroundMid,
          screenColors.backgroundSoft,
        ]}
        locations={[0, 0.5, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.goldGlow} pointerEvents="none" />
      <View style={styles.greenGlow} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardRoot}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(420)}
            style={styles.header}
          >
            <View>
              <AppText style={styles.kicker}>Neuer Tisch</AppText>
              <AppText style={styles.title}>Runde erstellen</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <X color={screenColors.gold} size={22} strokeWidth={2.5} />
            </Pressable>
          </Animated.View>

          <View style={styles.headerSymbols} pointerEvents="none">
            <AppText style={[styles.headerSuit, styles.headerSuitLeft]}>
              {'♣'}
            </AppText>
            <AppText style={[styles.headerSuit, styles.headerSuitRight]}>
              {'♥'}
            </AppText>
          </View>

          <Animated.View
            entering={FadeInDown.duration(460).delay(80)}
            style={styles.createCard}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Spade color={screenColors.gold} size={24} strokeWidth={2.4} />
              </View>
              <View style={styles.cardHeaderText}>
                <AppText style={styles.cardTitle}>Tisch einrichten</AppText>
                <AppText style={styles.cardCopy}>
                  Schnell, lokal und bereit für den Spielabend.
                </AppText>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <AppText style={styles.label}>Tischname</AppText>
              <TextInput
                autoCapitalize="words"
                keyboardAppearance="dark"
                onBlur={() => setFocusedInput(null)}
                onChangeText={setTableName}
                onFocus={() => setFocusedInput('table')}
                placeholder="z. B. Freitag Stammtisch"
                placeholderTextColor={screenColors.soft}
                returnKeyType="next"
                selectionColor={screenColors.gold}
                style={[
                  styles.input,
                  focusedInput === 'table' && styles.inputFocused,
                ]}
                value={tableName}
              />
            </View>

            <View style={styles.playerHeader}>
              <AppText style={styles.sectionTitle}>Spieler hinzufügen</AppText>
              <AppText style={styles.playerCount}>
                Spieler ({players.length}/{maxPlayers})
              </AppText>
            </View>

            <View style={styles.addPlayerRow}>
              <TextInput
                autoCapitalize="words"
                keyboardAppearance="dark"
                onBlur={() => setFocusedInput(null)}
                onChangeText={setPlayerName}
                onFocus={() => setFocusedInput('player')}
                onSubmitEditing={canAddPlayer ? addPlayer : undefined}
                placeholder="Spielername"
                placeholderTextColor={screenColors.soft}
                returnKeyType="done"
                selectionColor={screenColors.gold}
                style={[
                  styles.playerInput,
                  focusedInput === 'player' && styles.inputFocused,
                ]}
                value={playerName}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!canAddPlayer}
                onPress={addPlayer}
                style={({ pressed }) => [
                  styles.addButton,
                  !canAddPlayer && styles.disabledButton,
                  pressed && canAddPlayer && styles.pressed,
                ]}
              >
                <Plus color="#17150B" size={18} strokeWidth={2.8} />
                <AppText style={styles.addButtonText}>Hinzufügen</AppText>
              </Pressable>
            </View>

            <View style={styles.friendsSection}>
              <View style={styles.friendsHeader}>
                <View style={styles.friendsCopyBlock}>
                  <AppText style={styles.friendsTitle}>Freunde</AppText>
                  <AppText style={styles.friendsCopy}>
                    Schneller Einstieg mit deiner Runde.
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFriendPickerVisible(true)}
                  style={({ pressed }) => [
                    styles.friendPickerButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <UserPlus
                    color={screenColors.gold}
                    size={13}
                    strokeWidth={2.25}
                  />
                  <AppText style={styles.friendPickerText}>Hinzufügen</AppText>
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.friendScroller}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {FRIEND_PREVIEWS.map((friend) => (
                  <FriendChip
                    key={friend.id}
                    friend={friend}
                    isDisabled={
                      hasReachedMaxPlayers &&
                      !selectedFriendIdSet.has(friend.id)
                    }
                    isSelected={selectedFriendIdSet.has(friend.id)}
                    onPress={toggleFriend}
                  />
                ))}
              </ScrollView>
            </View>

            {players.length === 0 ? (
              <View style={styles.emptyPlayers}>
                <AppText style={styles.emptyTitle}>
                  Noch niemand am Tisch
                </AppText>
                <AppText style={styles.emptyCopy}>
                  Füge deine Runde hinzu. Ab zwei Spielern kann es losgehen.
                </AppText>
              </View>
            ) : (
              <View style={styles.playerChips}>
                {players.map((player, index) => (
                  <Animated.View
                    key={player.id}
                    entering={FadeInDown.duration(260).delay(index * 45)}
                  >
                    <PlayerPill
                      accentColor={player.accentColor}
                      animalId={player.animalId}
                      isCurrentUser={player.isCurrentUser}
                      name={player.name}
                      onRemove={() => removePlayer(player.id)}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.bottomActions}>
          <Pressable
            accessibilityLabel="Abbrechen"
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.floatingButton,
              styles.cancelFloating,
              pressed && styles.floatingPressed,
            ]}
          >
            <X color={screenColors.muted} size={28} strokeWidth={2.7} />
          </Pressable>

          <Pressable
            accessibilityLabel="Tisch erstellen"
            accessibilityRole="button"
            disabled={!canCreateTable}
            onPress={startGame}
            style={({ pressed }) => [
              styles.floatingButton,
              styles.createFloating,
              !canCreateTable && styles.disabledFloating,
              pressed && canCreateTable && styles.floatingPressed,
            ]}
          >
            <ArrowRight color="#17150B" size={30} strokeWidth={2.9} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <FriendPickerSheet
        friends={FRIEND_PREVIEWS}
        maxPlayersReached={hasReachedMaxPlayers}
        selectedFriendIds={selectedFriendIds}
        visible={friendPickerVisible}
        onClose={() => setFriendPickerVisible(false)}
        onToggleFriend={toggleFriend}
      />
    </AuthBackground>
  );
}

type PlayerPillProps = {
  accentColor: string;
  animalId: AnimalAvatarId;
  isCurrentUser?: boolean;
  name: string;
  onRemove: () => void;
};

function PlayerPill({
  accentColor,
  animalId,
  isCurrentUser = false,
  name,
  onRemove,
}: PlayerPillProps) {
  return (
    <View
      style={[
        styles.playerPill,
        isCurrentUser && {
          borderColor: accentColor,
          shadowColor: accentColor,
        },
      ]}
    >
      <AnimalAvatar
        accentColor={accentColor}
        animalId={animalId}
        highlighted={isCurrentUser}
        size={38}
      />
      <Text numberOfLines={1} style={styles.playerName}>
        {name}
      </Text>
      {isCurrentUser ? <AppText style={styles.youBadge}>Du</AppText> : null}
      <Pressable
        accessibilityLabel={`${name} entfernen`}
        accessibilityRole="button"
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeButton,
          pressed && styles.removePressed,
        ]}
      >
        <X color={screenColors.muted} size={15} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

function getManualPlayerAnimal(index: number): AnimalAvatarId {
  if (index === 0) {
    return DEFAULT_USER_APPEARANCE.avatarId;
  }

  const animals: AnimalAvatarId[] = [
    'bear',
    'owl',
    'wolf',
    'deer',
    'raccoon',
    'rabbit',
    'boar',
  ];

  return animals[(index - 1) % animals.length];
}

function getManualPlayerAccent(index: number) {
  const accents = [
    DEFAULT_USER_APPEARANCE.accentColor,
    '#B8923C',
    '#4B6478',
    '#A6524B',
    '#8B6742',
    '#3F6B48',
  ];

  return accents[index % accents.length];
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  content: {
    paddingBottom: 138,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.lg,
  },
  goldGlow: {
    backgroundColor: 'rgba(231, 198, 92, 0.11)',
    borderRadius: 140,
    height: 280,
    position: 'absolute',
    right: -130,
    top: -70,
    width: 280,
  },
  greenGlow: {
    backgroundColor: 'rgba(111, 169, 114, 0.08)',
    borderRadius: 170,
    bottom: 120,
    height: 340,
    left: -170,
    position: 'absolute',
    width: 340,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 76,
  },
  kicker: {
    color: screenColors.gold,
    fontSize: authTypography.caption,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: screenColors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: authSpacing.xs,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(26, 45, 36, 0.72)',
    borderColor: screenColors.border,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  headerSymbols: {
    height: 0,
    position: 'relative',
  },
  headerSuit: {
    color: 'rgba(231, 198, 92, 0.055)',
    fontSize: 92,
    fontWeight: '800',
    position: 'absolute',
  },
  headerSuitLeft: {
    left: 104,
    top: -68,
    transform: [{ rotate: '-13deg' }],
  },
  headerSuitRight: {
    right: 6,
    top: -92,
    transform: [{ rotate: '13deg' }],
  },
  createCard: {
    backgroundColor: 'rgba(26, 45, 36, 0.96)',
    borderColor: screenColors.border,
    borderRadius: 32,
    borderWidth: 1,
    elevation: 12,
    gap: authSpacing.lg,
    marginTop: authSpacing.xl,
    padding: authSpacing.xl,
    shadowColor: screenColors.shadow,
    shadowOffset: { height: 20, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.md,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(231, 198, 92, 0.12)',
    borderColor: 'rgba(231, 198, 92, 0.2)',
    borderRadius: 24,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    color: screenColors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  cardCopy: {
    color: screenColors.muted,
    fontSize: authTypography.caption,
    lineHeight: 20,
    marginTop: authSpacing.xs,
  },
  fieldGroup: {
    gap: authSpacing.sm,
  },
  label: {
    color: screenColors.muted,
    fontSize: authTypography.caption,
    fontWeight: '900',
  },
  input: {
    backgroundColor: screenColors.input,
    borderColor: 'rgba(245, 245, 245, 0.1)',
    borderRadius: 22,
    borderWidth: 1,
    color: screenColors.text,
    fontSize: 18,
    fontWeight: '800',
    minHeight: 60,
    paddingHorizontal: authSpacing.lg,
  },
  inputFocused: {
    borderColor: screenColors.gold,
    shadowColor: screenColors.gold,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  playerHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: screenColors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  playerCount: {
    color: screenColors.soft,
    fontSize: authTypography.caption,
    fontWeight: '800',
  },
  addPlayerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.sm,
  },
  playerInput: {
    backgroundColor: screenColors.input,
    borderColor: 'rgba(245, 245, 245, 0.1)',
    borderRadius: 22,
    borderWidth: 1,
    color: screenColors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    minHeight: 56,
    paddingHorizontal: authSpacing.lg,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: screenColors.gold,
    borderRadius: 20,
    flexDirection: 'row',
    gap: authSpacing.xs,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: authSpacing.md,
    shadowColor: screenColors.gold,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  disabledButton: {
    opacity: 0.42,
  },
  addButtonText: {
    color: '#17150B',
    fontSize: 13,
    fontWeight: '900',
  },
  friendsSection: {
    gap: authSpacing.sm,
  },
  friendsHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: authSpacing.sm,
    justifyContent: 'space-between',
  },
  friendsCopyBlock: {
    flex: 1,
    paddingRight: authSpacing.sm,
  },
  friendsTitle: {
    color: screenColors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  friendsCopy: {
    color: screenColors.soft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  friendPickerButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(231, 198, 92, 0.052)',
    borderColor: 'rgba(231, 198, 92, 0.11)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.xs,
    minHeight: 28,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  friendPickerText: {
    color: screenColors.gold,
    fontSize: 10,
    fontWeight: '800',
  },
  friendScroller: {
    gap: authSpacing.sm,
    paddingTop: 2,
    paddingRight: authSpacing.xl,
  },
  emptyPlayers: {
    backgroundColor: 'rgba(16, 36, 28, 0.74)',
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: 24,
    borderWidth: 1,
    padding: authSpacing.lg,
  },
  emptyTitle: {
    color: screenColors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyCopy: {
    color: screenColors.muted,
    fontSize: authTypography.caption,
    lineHeight: 20,
    marginTop: authSpacing.xs,
  },
  playerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
  playerPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(32, 55, 45, 0.92)',
    borderColor: screenColors.greenBorder,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.sm,
    maxWidth: '100%',
    minHeight: 46,
    paddingLeft: 4,
    paddingRight: authSpacing.sm,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  playerName: {
    color: screenColors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    maxWidth: 160,
  },
  youBadge: {
    color: screenColors.gold,
    fontSize: 10,
    fontWeight: '900',
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: authRadius.pill,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  removePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  bottomActions: {
    alignItems: 'center',
    bottom: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: authSpacing.xl,
    position: 'absolute',
    right: authSpacing.xl,
  },
  floatingButton: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    elevation: 12,
    height: 64,
    justifyContent: 'center',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    width: 64,
  },
  cancelFloating: {
    backgroundColor: 'rgba(26, 45, 36, 0.92)',
    borderColor: 'rgba(245, 245, 245, 0.1)',
    borderWidth: 1,
    shadowColor: screenColors.shadow,
  },
  createFloating: {
    backgroundColor: screenColors.gold,
    shadowColor: screenColors.gold,
  },
  disabledFloating: {
    opacity: 0.42,
  },
  floatingPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.95 }],
  },
});
