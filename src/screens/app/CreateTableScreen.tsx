import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Plus, Spade, UserPlus, X } from 'lucide-react-native';
import {
  type ComponentRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import Animated from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AnimalAvatar } from '../../components/game/AnimalAvatar';
import { CardSuitIcon } from '../../components/game/CardSuitIcon';
import { FriendChip } from '../../components/game/FriendChip';
import { FriendPickerSheet } from '../../components/game/FriendPickerSheet';
import { TableSettingsEditor } from '../../components/game/TableSettingsEditor';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import {
  DEFAULT_USER_APPEARANCE,
  PROFILE_ACCENTS,
} from '../../constants/profileCustomization';
import { createDefaultTableSettings } from '../../constants/tableSettings';
import { useFriendProfiles } from '../../hooks/useFriendProfiles';
import { useOwnProfile } from '../../hooks/useOwnProfile';
import type { AppStackScreenProps } from '../../navigation/types';
import { createLocalPlayer } from '../../services/game/addPlayer';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { formEntering, selectionEntering } from '../../theme/motion';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { Player, TableSettings } from '../../types/game';
import type { AnimalAvatarId, FriendProfile } from '../../types/profile';

type CreateTableScreenProps = AppStackScreenProps<'CreateTable'>;

type TablePlayer = Player & {
  accentColor: string;
  animalId: AnimalAvatarId;
  friendId?: string;
};

const screenColors = {
  background: authColors.tableBackground,
  backgroundMid: authColors.tableBackgroundMid,
  backgroundSoft: authColors.tableBackgroundSoft,
  card: authColors.tableCard,
  cardElevated: authColors.tableCardElevated,
  input: authColors.tableBackgroundMid,
  gold: authColors.goldHighlight,
  text: authColors.textPrimary,
  muted: authColors.textMuted,
  soft: authColors.textFaint,
  border: 'rgba(242, 201, 76, 0.24)',
  greenBorder: 'rgba(111, 169, 114, 0.2)',
  shadow: authColors.shadow,
};

const maxPlayers = 5;

export function CreateTableScreen({ navigation }: CreateTableScreenProps) {
  const playerInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const user = useAuthStore((state) => state.user);
  const { profile, displayName } = useOwnProfile();
  const currentUserProfile = useMemo<FriendProfile>(
    () => ({
      accentColor: PROFILE_ACCENTS[profile?.accentId ?? 'forestGreen'],
      avatarId: profile?.animalId ?? 'fox',
      avatarKind: profile?.avatarKind ?? 'none',
      accentId: profile?.accentId ?? 'forestGreen',
      photoPath: profile?.photoPath,
      id: user?.id ?? 'current-user',
      isOnline: true,
      username: displayName,
    }),
    [profile, displayName, user?.id],
  );
  const { accounts, error: friendsError } = useFriendProfiles();
  const selectableProfiles = useMemo(
    () => [
      currentUserProfile,
      ...accounts.filter((account) => account.id !== currentUserProfile.id),
    ],
    [accounts, currentUserProfile],
  );
  const [tableName, setTableName] = useState(
    () =>
      `Tisch vom ${new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })}`,
  );
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<TablePlayer[]>(() => [
    {
      ...createProfilePlayer(currentUserProfile),
      ...(user?.id ? { userId: user.id } : {}),
    },
  ]);
  const [friendPickerVisible, setFriendPickerVisible] = useState(false);
  const [tableSettings, setTableSettings] = useState<TableSettings>(() =>
    createDefaultTableSettings(),
  );
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

    if (players.length >= maxPlayers) return;
    if (
      players.some(
        (player) => player.name.trim().toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      Alert.alert(
        'Name bereits vorhanden',
        'Dieser Spieler ist schon am Tisch.',
      );
      return;
    }
    setPlayers((currentPlayers) => [
      ...currentPlayers,
      {
        ...createLocalPlayer(nextName),
        accentColor: getManualPlayerAccent(currentPlayers.length),
        animalId: getManualPlayerAnimal(currentPlayers.length),
      },
    ]);
    setPlayerName('');
    playerInputRef.current?.focus();
  }

  const toggleFriend = useCallback(
    (friend: FriendProfile) => {
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
            ...(friend.id === user?.id
              ? { userId: friend.id, isLocal: false }
              : {}),
          },
        ];
      });
    },
    [user?.id],
  );

  function removePlayer(id: string) {
    setPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== id),
    );
  }

  async function startGame() {
    const didCreate = await createTable(tableName, players, tableSettings);

    if (!didCreate) {
      Alert.alert(
        'Tisch nicht bereit',
        useGameStore.getState().activeGame
          ? 'Es läuft bereits ein Tisch. Bitte schließe diesen zuerst ab.'
          : 'Bitte gib einen Tischnamen ein und füge mindestens zwei Spieler hinzu.',
      );
      return;
    }

    navigation.replace('ActiveGame');
  }

  function closeCreateTable() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('AppTabs', { screen: 'GameLobby' });
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
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : Platform.OS === 'android'
              ? 'height'
              : undefined
        }
        style={styles.keyboardRoot}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={formEntering} style={styles.header}>
            <View>
              <AppText style={styles.kicker}>Neuer Tisch</AppText>
              <AppText style={styles.title}>Runde erstellen</AppText>
            </View>
            <Pressable
              accessibilityLabel="Runde erstellen schließen"
              accessibilityRole="button"
              onPress={closeCreateTable}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                icon={X}
                size="lg"
                weight="strong"
                color={screenColors.gold}
              />
            </Pressable>
          </Animated.View>

          <View style={styles.headerSymbols} pointerEvents="none">
            <View style={styles.headerSuit}>
              <CardSuitIcon
                suit="herz"
                color="rgba(242, 201, 76, 0.055)"
                size={92}
              />
            </View>
          </View>

          <Animated.View entering={formEntering} style={styles.createCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <AppIcon
                  icon={Spade}
                  size="lg"
                  weight="strong"
                  color={screenColors.gold}
                />
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
                submitBehavior="submit"
                onSubmitEditing={() => playerInputRef.current?.focus()}
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
                ref={playerInputRef}
                autoCapitalize="words"
                keyboardAppearance="dark"
                onBlur={() => setFocusedInput(null)}
                onChangeText={setPlayerName}
                onFocus={() => setFocusedInput('player')}
                onSubmitEditing={canAddPlayer ? addPlayer : undefined}
                placeholder="Spielername"
                placeholderTextColor={screenColors.soft}
                returnKeyType="next"
                submitBehavior="submit"
                selectionColor={screenColors.gold}
                style={[
                  styles.playerInput,
                  focusedInput === 'player' && styles.inputFocused,
                ]}
                value={playerName}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Spielplatz am Tisch hinzufügen"
                disabled={!canAddPlayer}
                onPress={addPlayer}
                style={({ pressed }) => [
                  styles.addButton,
                  !canAddPlayer && styles.disabledButton,
                  pressed && canAddPlayer && styles.pressed,
                ]}
              >
                <AppIcon
                  icon={Plus}
                  size="sm"
                  weight="strong"
                  color={authColors.onGold}
                />
                <AppText style={styles.addButtonText}>Hinzufügen</AppText>
              </Pressable>
            </View>

            <View style={styles.friendsSection}>
              <View style={styles.friendsHeader}>
                <View style={styles.friendsCopyBlock}>
                  <AppText style={styles.friendsTitle}>
                    Spielerplätze aus Freunden
                  </AppText>
                  <AppText style={styles.friendsCopy}>
                    Kontozugriff kannst du später per Tischeinladung anbieten.
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
                  <AppIcon
                    icon={UserPlus}
                    size="xs"
                    color={screenColors.gold}
                  />
                  <AppText style={styles.friendPickerText}>Hinzufügen</AppText>
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.friendScroller}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {selectableProfiles.map((friend) => (
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
                {players.map((player) => (
                  <Animated.View key={player.id} entering={selectionEntering}>
                    <PlayerPill
                      accentColor={player.accentColor}
                      animalId={player.animalId}
                      name={player.name}
                      onRemove={() => removePlayer(player.id)}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>

          <Animated.View entering={formEntering} style={styles.settingsCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderText}>
                <AppText style={styles.cardTitle}>Regeln & Tarife</AppText>
                <AppText style={styles.cardCopy}>
                  Lege fest, welche Spielarten und Boni an diesem Tisch gelten.
                </AppText>
              </View>
            </View>
            <TableSettingsEditor
              settings={tableSettings}
              onChange={setTableSettings}
            />
          </Animated.View>
        </ScrollView>

        <View style={styles.bottomActions}>
          <Pressable
            accessibilityLabel="Abbrechen"
            accessibilityRole="button"
            onPress={closeCreateTable}
            style={({ pressed }) => [
              styles.floatingButton,
              styles.cancelFloating,
              pressed && styles.floatingPressed,
            ]}
          >
            <AppIcon
              icon={X}
              size="xl"
              weight="strong"
              color={screenColors.muted}
            />
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
            <AppIcon
              icon={ArrowRight}
              size="xl"
              weight="strong"
              color={authColors.onGold}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {!!friendsError && (
        <AppText accessibilityRole="alert">{friendsError}</AppText>
      )}
      <FriendPickerSheet
        visible={friendPickerVisible}
        onClose={() => setFriendPickerVisible(false)}
        onToggleFriend={toggleFriend}
        friends={selectableProfiles}
        selectedFriendIds={selectedFriendIds}
        maxPlayersReached={hasReachedMaxPlayers}
      />
    </AuthBackground>
  );
}

type PlayerPillProps = {
  accentColor: string;
  animalId: AnimalAvatarId;
  name: string;
  onRemove: () => void;
};

function PlayerPill({
  accentColor,
  animalId,
  name,
  onRemove,
}: PlayerPillProps) {
  return (
    <View style={styles.playerPill}>
      <AnimalAvatar accentColor={accentColor} animalId={animalId} size={38} />
      <Text numberOfLines={1} style={styles.playerName}>
        {name}
      </Text>
      <Pressable
        accessibilityLabel={`${name} entfernen`}
        accessibilityRole="button"
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeButton,
          pressed && styles.removePressed,
        ]}
      >
        <AppIcon
          icon={X}
          size="xs"
          weight="strong"
          color={screenColors.muted}
        />
      </Pressable>
    </View>
  );
}

function createProfilePlayer(profile: FriendProfile): TablePlayer {
  return {
    ...createLocalPlayer(profile.username),
    accentColor: profile.accentColor,
    animalId: profile.avatarId,
    friendId: profile.id,
  };
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
    PROFILE_ACCENTS.amber,
    PROFILE_ACCENTS.mutedBlue,
    PROFILE_ACCENTS.warmRed,
    PROFILE_ACCENTS.bronze,
    PROFILE_ACCENTS.forestGreen,
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
    backgroundColor: 'rgba(242, 201, 76, 0.11)',
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
    fontSize: authTypography.amount,
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
    position: 'absolute',
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
  settingsCard: {
    backgroundColor: 'rgba(26, 45, 36, 0.96)',
    borderColor: screenColors.border,
    borderRadius: 32,
    borderWidth: 1,
    elevation: 12,
    gap: authSpacing.xl,
    marginTop: authSpacing.xl,
    padding: authSpacing.lg,
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
    backgroundColor: 'rgba(242, 201, 76, 0.12)',
    borderColor: 'rgba(242, 201, 76, 0.2)',
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
    fontSize: authTypography.subtitle,
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
    fontSize: authTypography.subhead,
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
    fontSize: authTypography.subhead,
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
    fontSize: authTypography.body,
    fontWeight: '800',
    minHeight: 56,
    // Lets the field shrink so the add button always stays inside the card.
    minWidth: 0,
    paddingHorizontal: authSpacing.lg,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: screenColors.gold,
    borderRadius: 20,
    flexDirection: 'row',
    gap: authSpacing.xs,
    justifyContent: 'center',
    flexShrink: 0,
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
    color: authColors.onGold,
    fontSize: authTypography.caption,
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
    fontSize: authTypography.button,
    fontWeight: '900',
  },
  friendsCopy: {
    color: screenColors.soft,
    fontSize: authTypography.control,
    fontWeight: '800',
    marginTop: 3,
  },
  friendPickerButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242, 201, 76, 0.052)',
    borderColor: 'rgba(242, 201, 76, 0.11)',
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
    fontSize: authTypography.micro,
    fontWeight: '800',
  },
  friendScroller: {
    gap: authSpacing.sm,
    paddingTop: 2,
    paddingRight: authSpacing.xl,
  },
  emptyPlayers: {
    backgroundColor: 'rgba(16, 36, 28, 0.74)',
    borderColor: authColors.borderSoft,
    borderRadius: 24,
    borderWidth: 1,
    padding: authSpacing.lg,
  },
  emptyTitle: {
    color: screenColors.text,
    fontSize: authTypography.body,
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
    fontSize: authTypography.label,
    fontWeight: '800',
    maxWidth: 160,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: authColors.borderSoft,
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
