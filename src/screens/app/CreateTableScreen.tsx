import { Plus, UserPlus, X } from 'lucide-react-native';
import {
  type ComponentRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { AnimalAvatar } from '../../components/game/AnimalAvatar';
import { FriendPickerSheet } from '../../components/game/FriendPickerSheet';
import { TableSettingsEditor } from '../../components/game/TableSettingsEditor';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { Notice } from '../../components/ui/Notice';
import { PageHeader, RoundIconButton } from '../../components/ui/PageHeader';
import { PROFILE_ACCENTS } from '../../constants/profileCustomization';
import { createDefaultTableSettings } from '../../constants/tableSettings';
import { useFriendProfiles } from '../../hooks/useFriendProfiles';
import { useOwnProfile } from '../../hooks/useOwnProfile';
import type { AppStackScreenProps } from '../../navigation/types';
import { createLocalPlayer } from '../../services/game/addPlayer';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors as c, authTextStyles } from '../../theme';
import { formEntering, selectionEntering } from '../../theme/motion';
import { authControlSizes, authRadius, authSpacing } from '../../theme/spacing';
import type { Player, TableSettings } from '../../types/game';
import type { AnimalAvatarId, FriendProfile } from '../../types/profile';

type CreateTableScreenProps = AppStackScreenProps<'CreateTable'>;

type TablePlayer = Player & {
  accentColor: string;
  animalId: AnimalAvatarId;
  friendId?: string;
  isSelf?: boolean;
};

const maxPlayers = 5;

const manualAnimals: AnimalAvatarId[] = [
  'bear',
  'owl',
  'wolf',
  'deer',
  'raccoon',
  'rabbit',
  'boar',
  'fox',
];
const manualAccents = [
  '#B8923C',
  '#4B6478',
  '#A6524B',
  '#8B6742',
  '#3F6B48',
  '#6E5A8A',
];

/** Picks an avatar and colour that nobody at the table uses yet. */
function nextAppearance(players: TablePlayer[]) {
  const animal =
    manualAnimals.find((id) => !players.some((p) => p.animalId === id)) ??
    manualAnimals[players.length % manualAnimals.length];
  const accent =
    manualAccents.find(
      (color) => !players.some((p) => p.accentColor === color),
    ) ?? manualAccents[players.length % manualAccents.length];
  return { animalId: animal, accentColor: accent };
}

function todayName() {
  return `Tisch vom ${new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`;
}

export function CreateTableScreen({
  navigation,
  route,
}: CreateTableScreenProps) {
  const insets = useSafeAreaInsets();
  const playerInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const user = useAuthStore((state) => state.user);
  const activeGame = useGameStore((state) => state.activeGame);
  const { profile, displayName } = useOwnProfile();
  const { accounts, error: friendsError } = useFriendProfiles();
  const userId = user?.id;
  const friendProfiles = useMemo(
    () => (userId ? accounts.filter((a) => a.id !== userId) : []),
    [accounts, userId],
  );
  const templateId = route?.params?.templateTableId;
  const template = useMemo(() => {
    if (!templateId) return null;
    const state = useGameStore.getState();
    const day = state.archivedGameDays.find((d) => d.table.id === templateId);
    if (day) return { players: day.players, settings: day.table.settings };
    if (state.currentTable?.id === templateId)
      return {
        players: state.players,
        settings: state.currentTable.settings,
      };
    return null;
  }, [templateId]);

  const [tableName, setTableName] = useState(todayName);
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<TablePlayer[]>(() => {
    const self: TablePlayer = {
      ...createLocalPlayer(displayName),
      accentColor: PROFILE_ACCENTS[profile?.accentId ?? 'forestGreen'],
      animalId: profile?.animalId ?? 'fox',
      isSelf: true,
      ...(user?.id ? { userId: user.id } : { guestSelf: true }),
    };
    const list: TablePlayer[] = [self];
    for (const player of template?.players ?? []) {
      const isSelf = user?.id
        ? player.userId === user.id
        : player.name.trim().toLowerCase() === displayName.trim().toLowerCase();
      if (isSelf || list.length >= maxPlayers) continue;
      list.push({
        ...createLocalPlayer(player.name),
        ...(player.userId
          ? { userId: player.userId, isLocal: player.isLocal }
          : {}),
        ...nextAppearance(list),
      });
    }
    return list;
  });
  const [friendPickerVisible, setFriendPickerVisible] = useState(false);
  const [tableSettings, setTableSettings] = useState<TableSettings>(
    () => template?.settings ?? createDefaultTableSettings(),
  );
  const [focusedInput, setFocusedInput] = useState<'table' | 'player' | null>(
    null,
  );
  const [error, setError] = useState('');
  const createTable = useGameStore((state) => state.createTable);

  const hasReachedMaxPlayers = players.length >= maxPlayers;
  const canAddPlayer = playerName.trim().length > 0 && !hasReachedMaxPlayers;
  const canCreateTable =
    !activeGame && tableName.trim().length > 0 && players.length >= 2;
  const selectedFriendIds = useMemo(
    () =>
      players
        .map((player) => player.friendId)
        .filter((friendId): friendId is string => Boolean(friendId)),
    [players],
  );

  function addPlayer() {
    const nextName = playerName.trim();
    if (!nextName || hasReachedMaxPlayers) return;
    if (
      players.some(
        (player) => player.name.trim().toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      setError(`${nextName} sitzt schon am Tisch.`);
      return;
    }
    setError('');
    setPlayers((current) => [
      ...current,
      { ...createLocalPlayer(nextName), ...nextAppearance(current) },
    ]);
    setPlayerName('');
    playerInputRef.current?.focus();
  }

  const toggleFriend = useCallback((friend: FriendProfile) => {
    setPlayers((current) => {
      const existing = current.find((player) => player.friendId === friend.id);
      if (existing) return current.filter((p) => p.id !== existing.id);
      const existsByName = current.some(
        (player) =>
          player.name.trim().toLowerCase() ===
          friend.username.trim().toLowerCase(),
      );
      if (existsByName || current.length >= maxPlayers) return current;
      return [
        ...current,
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
    setPlayers((current) => current.filter((player) => player.id !== id));
  }

  async function startGame() {
    setError('');
    const didCreate = await createTable(
      tableName,
      players.map(({ isSelf: _self, ...player }) => player),
      tableSettings,
    );
    if (!didCreate) {
      setError(
        useGameStore.getState().activeGame
          ? 'Es läuft bereits ein Tisch. Schließe ihn zuerst ab.'
          : 'Bitte gib einen Tischnamen ein und setze mindestens zwei Spieler an den Tisch.',
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
          <PageHeader
            title="Neuer Tisch"
            subtitle={
              template ? 'Mit Spielern und Tarifen als Vorlage' : undefined
            }
            action={
              <RoundIconButton
                accessibilityLabel="Neuer Tisch schließen"
                onPress={closeCreateTable}
              >
                <X color={c.goldHighlight} size={20} strokeWidth={2.4} />
              </RoundIconButton>
            }
          />

          {activeGame ? (
            <Notice tone="info">
              Es läuft bereits ein Tisch. Schließe ihn zuerst ab, bevor du einen
              neuen startest.
            </Notice>
          ) : null}

          <Animated.View entering={formEntering} style={styles.card}>
            <View style={styles.fieldGroup}>
              <AppText style={styles.label}>Tischname</AppText>
              <TextInput
                accessibilityLabel="Tischname"
                autoCapitalize="words"
                keyboardAppearance="dark"
                onBlur={() => setFocusedInput(null)}
                onChangeText={setTableName}
                onFocus={() => setFocusedInput('table')}
                placeholder="z. B. Freitag Stammtisch"
                placeholderTextColor={c.textSecondary}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => playerInputRef.current?.focus()}
                selectionColor={c.gold}
                style={[
                  styles.input,
                  focusedInput === 'table' && styles.inputFocused,
                ]}
                value={tableName}
              />
            </View>

            <View style={styles.playerHeader}>
              <AppText style={styles.sectionTitle}>Spieler</AppText>
              <AppText style={styles.playerCount}>
                {players.length} / {maxPlayers}
              </AppText>
            </View>

            <View style={styles.addPlayerRow}>
              <TextInput
                ref={playerInputRef}
                accessibilityLabel="Spielername"
                autoCapitalize="words"
                editable={!hasReachedMaxPlayers}
                keyboardAppearance="dark"
                onBlur={() => setFocusedInput(null)}
                onChangeText={(value) => {
                  setPlayerName(value);
                  if (error) setError('');
                }}
                onFocus={() => setFocusedInput('player')}
                onSubmitEditing={canAddPlayer ? addPlayer : undefined}
                placeholder={
                  hasReachedMaxPlayers ? 'Tisch ist voll' : 'Spielername'
                }
                placeholderTextColor={c.textSecondary}
                returnKeyType="next"
                submitBehavior="submit"
                selectionColor={c.gold}
                style={[
                  styles.input,
                  styles.playerInput,
                  focusedInput === 'player' && styles.inputFocused,
                ]}
                value={playerName}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Spielplatz am Tisch hinzufügen"
                accessibilityState={{ disabled: !canAddPlayer }}
                disabled={!canAddPlayer}
                onPress={addPlayer}
                style={({ pressed }) => [
                  styles.addButton,
                  !canAddPlayer && styles.disabled,
                  pressed && canAddPlayer && styles.pressed,
                ]}
              >
                <Plus color={c.goldHighlight} size={18} strokeWidth={2.6} />
                <AppText style={styles.addButtonText}>Hinzufügen</AppText>
              </Pressable>
            </View>

            {user?.id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Freunde hinzufügen"
                onPress={() => setFriendPickerVisible(true)}
                style={({ pressed }) => [
                  styles.friendsButton,
                  pressed && styles.pressed,
                ]}
              >
                <UserPlus color={c.goldHighlight} size={18} strokeWidth={2.3} />
                <AppText style={styles.friendsButtonText}>
                  Freunde hinzufügen
                </AppText>
              </Pressable>
            ) : null}

            <View style={styles.playerChips}>
              {players.map((player) => (
                <Animated.View key={player.id} entering={selectionEntering}>
                  <PlayerPill
                    player={player}
                    onRemove={
                      player.isSelf ? undefined : () => removePlayer(player.id)
                    }
                  />
                </Animated.View>
              ))}
            </View>
            {players.length < 2 ? (
              <AppText style={styles.hint}>
                Ab zwei Spielern kann es losgehen.
              </AppText>
            ) : null}
            {error ? <Notice>{error}</Notice> : null}
            {friendsError && user?.id ? <Notice>{friendsError}</Notice> : null}
          </Animated.View>

          <Animated.View entering={formEntering} style={styles.card}>
            <AppText style={styles.sectionTitle}>Regeln & Tarife</AppText>
            <TableSettingsEditor
              settings={tableSettings}
              onChange={setTableSettings}
            />
          </Animated.View>

          {!activeGame ? (
            <AppText style={styles.hint}>
              Es kann immer nur ein Tisch gleichzeitig laufen.
            </AppText>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, authSpacing.md) },
          ]}
        >
          <AppButton
            title="Abbrechen"
            variant="secondary"
            onPress={closeCreateTable}
            style={styles.cancel}
          />
          <GoldButton
            title="Tisch starten"
            disabled={!canCreateTable}
            onPress={() => void startGame()}
            style={styles.start}
          />
        </View>
      </KeyboardAvoidingView>

      <FriendPickerSheet
        visible={friendPickerVisible}
        onClose={() => setFriendPickerVisible(false)}
        onToggleFriend={toggleFriend}
        friends={friendProfiles}
        selectedFriendIds={selectedFriendIds}
        maxPlayersReached={hasReachedMaxPlayers}
      />
    </AuthBackground>
  );
}

function PlayerPill({
  player,
  onRemove,
}: {
  player: TablePlayer;
  onRemove?: () => void;
}) {
  const label = player.isSelf ? `${player.name} (du)` : player.name;
  return (
    <View style={styles.playerPill}>
      <AnimalAvatar
        accentColor={player.accentColor}
        animalId={player.animalId}
        size={30}
      />
      <Text numberOfLines={1} style={styles.playerName}>
        {label}
      </Text>
      {onRemove ? (
        <Pressable
          accessibilityLabel={`${player.name} entfernen`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.pressed,
          ]}
        >
          <X color={c.textSecondary} size={15} strokeWidth={2.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  content: {
    gap: authSpacing.lg,
    paddingBottom: authSpacing.xl,
    paddingHorizontal: authSpacing.xl,
  },
  card: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    gap: authSpacing.md,
    padding: authSpacing.lg,
  },
  fieldGroup: { gap: authSpacing.sm },
  label: {
    ...authTextStyles.caption,
    color: c.textMutedGreen,
    fontWeight: '700',
  },
  input: {
    backgroundColor: c.inputFill,
    borderColor: c.inputBorder,
    borderRadius: authRadius.sm,
    borderWidth: 1,
    color: c.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    minHeight: authControlSizes.field,
    paddingHorizontal: authSpacing.md,
  },
  inputFocused: { borderColor: c.inputFocused },
  playerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: authSpacing.xs,
  },
  sectionTitle: {
    ...authTextStyles.subhead,
    color: c.textPrimary,
    fontWeight: '700',
  },
  playerCount: { ...authTextStyles.caption, color: c.textSecondary },
  addPlayerRow: { flexDirection: 'row', gap: authSpacing.sm },
  playerInput: { flex: 1, minWidth: 0 },
  addButton: {
    alignItems: 'center',
    borderColor: c.borderGold,
    borderRadius: authRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 4,
    minHeight: authControlSizes.field,
    paddingHorizontal: authSpacing.md,
  },
  addButtonText: { color: c.goldHighlight, fontSize: 15, fontWeight: '700' },
  friendsButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: authSpacing.sm,
    minHeight: authControlSizes.touch,
  },
  friendsButtonText: {
    color: c.goldHighlight,
    fontSize: 15,
    fontWeight: '700',
  },
  playerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: authSpacing.sm },
  playerPill: {
    alignItems: 'center',
    backgroundColor: c.control,
    borderColor: c.controlBorder,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.sm,
    maxWidth: 240,
    minHeight: 40,
    paddingLeft: 5,
    paddingRight: authSpacing.md,
  },
  playerName: {
    color: c.textPrimary,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  removeButton: { marginLeft: 2, padding: 2 },
  hint: { ...authTextStyles.caption, color: c.textSecondary },
  bottomBar: {
    backgroundColor: c.background,
    borderTopColor: c.borderSoft,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: authSpacing.md,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.md,
  },
  cancel: { flex: 1, minHeight: 56 },
  start: { flex: 2 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
