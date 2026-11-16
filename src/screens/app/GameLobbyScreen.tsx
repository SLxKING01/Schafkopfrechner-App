import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  ChevronRight,
  Copy,
  GripVertical,
  Heart,
  Leaf,
  LogOut,
  type LucideProps,
  Nut,
  Pencil,
  Pin,
  Plus,
  Settings,
  Spade,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  type ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeOutLeft } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { SchafkopfBackdrop } from '../../components/dashboard/SchafkopfBackdrop';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { SharedTableConflictNotice } from '../../components/game/SharedTablePanel';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { PageHeader } from '../../components/ui/PageHeader';
import type { AppStackParamList } from '../../navigation/types';
import {
  openSharedTable,
  useSharedTableStatus,
} from '../../services/shared/sharedTables';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useTableVisibilityStore } from '../../store/tableVisibilityStore';
import { authColors } from '../../theme/colors';
import { authControlSizes, authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { isStockBooking } from '../../utils/accounting';
import {
  areTableOrderIdsEqual,
  sanitizeTableOrderIds,
} from '../../utils/tableOrder';

const screenColors = {
  background: authColors.tableBackground,
  backgroundMid: authColors.tableBackgroundMid,
  backgroundSoft: authColors.tableBackgroundSoft,
  card: authColors.tableCard,
  gold: authColors.goldHighlight,
  text: authColors.textPrimary,
  muted: authColors.textMuted,
  soft: authColors.textFaint,
  border: 'rgba(242, 201, 76, 0.28)',
  shadow: authColors.shadow,
};

const suitTheme = {
  eichel: {
    background: 'rgba(143, 94, 44, 0.22)',
    border: 'rgba(242, 201, 76, 0.26)',
    glow: 'rgba(242, 201, 76, 0.22)',
    icon: Nut,
    label: 'Eichel',
    tone: authColors.suitEichel,
  },
  gras: {
    background: 'rgba(66, 113, 82, 0.24)',
    border: 'rgba(111, 169, 114, 0.24)',
    glow: 'rgba(111, 169, 114, 0.18)',
    icon: Leaf,
    label: 'Gras',
    tone: authColors.suitGras,
  },
  herz: {
    background: 'rgba(151, 60, 55, 0.22)',
    border: 'rgba(224, 99, 92, 0.24)',
    glow: 'rgba(224, 99, 92, 0.2)',
    icon: Heart,
    label: 'Herz',
    tone: authColors.suitHerz,
  },
  schelle: {
    background: 'rgba(242, 201, 76, 0.2)',
    border: 'rgba(242, 201, 76, 0.28)',
    glow: 'rgba(242, 201, 76, 0.24)',
    icon: Bell,
    label: 'Schelle',
    tone: authColors.suitSchellen,
  },
} satisfies Record<
  SchafkopfSuit,
  {
    background: string;
    border: string;
    glow: string;
    icon: ComponentType<LucideProps>;
    label: string;
    tone: string;
  }
>;

type SchafkopfSuit = 'eichel' | 'gras' | 'herz' | 'schelle';

type TablePreview = {
  id: string;
  name: string;
  players: string;
  lastPlayed: string;
  suit: SchafkopfSuit;
  isCurrent?: boolean;
  hasOpenPayments?: boolean;
  isFavorite?: boolean;
  sortOrder?: number;
};

type GameLobbyNavigationProp = NativeStackNavigationProp<AppStackParamList>;
type TableRenderParams =
  | RenderItemParams<TablePreview>
  | ListRenderItemInfo<TablePreview>;

function getTableOrder(table: TablePreview, orderedIds: string[]) {
  const orderIndex = orderedIds.indexOf(table.id);

  if (orderIndex >= 0) {
    return orderIndex;
  }

  return table.sortOrder ?? Number.MAX_SAFE_INTEGER;
}

function createUniqueTables(tables: TablePreview[]) {
  const seenTableIds = new Set<string>();
  const uniqueTables: TablePreview[] = [];

  tables.forEach((table) => {
    const tableId = table.id.trim();

    if (!tableId || seenTableIds.has(tableId)) {
      return;
    }

    seenTableIds.add(tableId);
    uniqueTables.push({ ...table, id: tableId });
  });

  return uniqueTables;
}

export function GameLobbyScreen() {
  const navigation = useNavigation<GameLobbyNavigationProp>();
  const userId = useAuthStore((state) => state.user?.id);
  const shared = useSharedTableStatus();
  const remoteTables = useMemo(
    () => (shared.tablesUserId === userId ? shared.tables : []),
    [shared.tablesUserId, shared.tables, userId],
  );
  const currentTable = useGameStore((state) => state.currentTable);
  const players = useGameStore((state) => state.players);
  const archivedGameDays = useGameStore((state) => state.archivedGameDays);
  const activeGame = useGameStore((state) => state.activeGame);
  const tableOrderIds = useGameStore((state) => state.tableOrderIds);
  const setPersistedTableOrderIds = useGameStore(
    (state) => state.setTableOrderIds,
  );
  const [renamedTables, setRenamedTables] = useState<Record<string, string>>(
    {},
  );
  const [renameTable, setRenameTable] = useState<TablePreview | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenameFocused, setIsRenameFocused] = useState(false);
  const [leaveTableCandidate, setLeaveTableCandidate] =
    useState<TablePreview | null>(null);
  const visibility = useTableVisibilityStore();
  const { hydrate: hydrateVisibility, hideTable } = visibility;
  const scope = userId ? `user:${userId}` : 'guest';
  const removedTableIds = visibility.hiddenByScope[scope];
  useEffect(() => {
    void hydrateVisibility();
  }, [hydrateVisibility]);
  const [favoriteTableIds, setFavoriteTableIds] = useState<string[]>([]);
  const [activeReorderTableId, setActiveReorderTableId] = useState<
    string | null
  >(null);

  const baseTables = useMemo(() => {
    const tables: TablePreview[] = currentTable
      ? [
          {
            id: currentTable.id,
            isCurrent: true,
            lastPlayed: activeGame
              ? 'Spielabend läuft'
              : 'Spielabend abgeschlossen',
            name: currentTable.name,
            players: players.map((player) => player.name).join(' \u2022 '),
            isFavorite: currentTable.isFavorite,
            sortOrder: currentTable.sortOrder ?? 0,
            suit: 'schelle' as const,
          },
        ]
      : [];

    const archivedTables: TablePreview[] = archivedGameDays.map((day) => {
      const openPayments = day.settlements.filter(
        (payment) => !payment.isPaid,
      ).length;
      return {
        id: day.table.id,
        name: day.table.name,
        players: day.players.map((player) => player.name).join(' · '),
        lastPlayed: `${day.rounds.filter((round) => !isStockBooking(round)).length} Spiele · ${day.table.isActive ? 'Läuft' : openPayments > 0 ? `${openPayments} Zahlungen offen` : 'Abgerechnet'}`,
        suit: 'schelle',
        isCurrent: false,
        hasOpenPayments: openPayments > 0,
        isFavorite: day.table.isFavorite,
        sortOrder: day.table.sortOrder,
      };
    });
    const automaticTables: TablePreview[] = remoteTables.map((remote) => ({
      id: remote.id,
      name: remote.payload.currentTable.name,
      players: remote.payload.players.map((player) => player.name).join(' · '),
      lastPlayed: remote.payload.activeGame
        ? 'Gemeinsamer Tisch · läuft'
        : 'Gemeinsamer Tisch · abgeschlossen',
      suit: 'schelle',
      isCurrent: remote.id === currentTable?.id,
    }));
    // Prefer the archived snapshot for a completed table, without duplicating it.
    return createUniqueTables(
      activeGame
        ? [...tables, ...automaticTables, ...archivedTables]
        : [...automaticTables, ...archivedTables, ...tables],
    );
  }, [activeGame, archivedGameDays, currentTable, players, remoteTables]);

  const availableTableIds = useMemo(
    () => baseTables.map((table) => table.id),
    [baseTables],
  );
  const safeTableOrderIds = useMemo(
    () => sanitizeTableOrderIds(tableOrderIds, availableTableIds),
    [availableTableIds, tableOrderIds],
  );

  useEffect(() => {
    if (
      !Array.isArray(tableOrderIds) ||
      !areTableOrderIdsEqual(tableOrderIds, safeTableOrderIds)
    ) {
      setPersistedTableOrderIds(safeTableOrderIds);
    }
  }, [safeTableOrderIds, setPersistedTableOrderIds, tableOrderIds]);

  const visibleTables = useMemo(() => {
    return baseTables
      .map((table) => ({
        ...table,
        isFavorite: favoriteTableIds.includes(table.id) || table.isFavorite,
        name: renamedTables[table.id] ?? table.name,
        sortOrder: getTableOrder(table, safeTableOrderIds),
      }))
      .filter(
        (table) =>
          (table.isCurrent && activeGame) ||
          table.hasOpenPayments ||
          !removedTableIds?.includes(table.id),
      )
      .sort((firstTable, secondTable) => {
        if (firstTable.isFavorite === secondTable.isFavorite) {
          return firstTable.sortOrder - secondTable.sortOrder;
        }

        return firstTable.isFavorite ? -1 : 1;
      });
  }, [
    activeGame,
    baseTables,
    favoriteTableIds,
    removedTableIds,
    renamedTables,
    safeTableOrderIds,
  ]);

  const visibleTableIds = useMemo(
    () => visibleTables.map((table) => table.id),
    [visibleTables],
  );

  const openCreateTable = useCallback(() => {
    navigation.navigate('CreateTable');
  }, [navigation]);

  const openTable = useCallback(
    (table: TablePreview) => {
      if (useGameStore.getState().resumeTable(table.id)) {
        navigation.navigate('ActiveGame');
        return;
      }
      const remote = remoteTables.find(
        (candidate) => candidate.id === table.id,
      );
      if (remote) {
        void openSharedTable(table.id)
          .then(() => {
            if (useGameStore.getState().activeGame)
              navigation.navigate('ActiveGame');
            else navigation.navigate('Settlement', { tableId: table.id });
          })
          .catch((reason: Error) =>
            Alert.alert('Tisch nicht geöffnet', reason.message),
          );
        return;
      }
      if (table.id === currentTable?.id && activeGame) {
        navigation.navigate('ActiveGame');
      } else if (
        archivedGameDays.some((day) => day.table.id === table.id) ||
        table.id === currentTable?.id
      ) {
        navigation.navigate('Settlement', { tableId: table.id });
      }
    },
    [activeGame, archivedGameDays, currentTable?.id, navigation, remoteTables],
  );

  const openSettings = useCallback(() => {
    if (activeGame && currentTable) navigation.navigate('EditTable');
    else navigation.navigate('AppTabs', { screen: 'Profile' });
  }, [activeGame, currentTable, navigation]);

  const copyTable = useCallback((table: TablePreview) => {
    Alert.alert(
      'Tisch kopieren',
      `${table.name} wird später als Vorlage für neue Runden verwendet.`,
    );
  }, []);

  const leaveTable = useCallback((table: TablePreview) => {
    setLeaveTableCandidate(table);
  }, []);

  const toggleFavoriteTable = useCallback((table: TablePreview) => {
    setFavoriteTableIds((current) =>
      current.includes(table.id)
        ? current.filter((tableId) => tableId !== table.id)
        : [...current, table.id],
    );
  }, []);

  const reorderTables = useCallback(
    (nextTables: TablePreview[]) => {
      const favoriteIds = nextTables
        .filter((table) => table.isFavorite)
        .map((table) => table.id);
      const regularIds = nextTables
        .filter((table) => !table.isFavorite)
        .map((table) => table.id);
      const nextTableOrderIds = sanitizeTableOrderIds(
        [...favoriteIds, ...regularIds],
        visibleTableIds,
      );

      setPersistedTableOrderIds(nextTableOrderIds);
    },
    [setPersistedTableOrderIds, visibleTableIds],
  );

  const handleDragBegin = useCallback(
    (index: number) => {
      const table = visibleTables[index];

      if (table) {
        setActiveReorderTableId(table.id);
      }

      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync();
      }
    },
    [visibleTables],
  );

  const handleDragEnd = useCallback(
    (data: TablePreview[]) => {
      reorderTables(data);
      setActiveReorderTableId(null);
    },
    [reorderTables],
  );

  const closeLeaveTable = useCallback(() => {
    setLeaveTableCandidate(null);
  }, []);

  const confirmLeaveTable = useCallback(() => {
    if (!leaveTableCandidate) {
      return;
    }

    const tableId = leaveTableCandidate.id;
    setLeaveTableCandidate(null);
    if (
      (tableId === currentTable?.id && activeGame) ||
      leaveTableCandidate.hasOpenPayments
    )
      return;
    void hideTable(scope, tableId).catch((error: Error) =>
      Alert.alert('Tisch nicht entfernt', error.message),
    );
  }, [activeGame, currentTable?.id, leaveTableCandidate, hideTable, scope]);

  const openRenameTable = useCallback((table: TablePreview) => {
    setRenameTable(table);
    setRenameValue(table.name);
  }, []);

  const closeRenameTable = useCallback(() => {
    setRenameTable(null);
    setRenameValue('');
    setIsRenameFocused(false);
  }, []);

  const saveRenameTable = useCallback(() => {
    if (!renameTable) {
      return;
    }

    const nextName = renameValue.trim();

    if (!nextName) {
      return;
    }

    setRenamedTables((current) => ({
      ...current,
      [renameTable.id]: nextName,
    }));
    closeRenameTable();
  }, [closeRenameTable, renameTable, renameValue]);

  const renderTableItem = useCallback(
    (params: TableRenderParams) => (
      <View style={styles.tableListItem}>
        <TableCard
          table={params.item}
          canReorder={'drag' in params}
          isDraggingAny={activeReorderTableId !== null}
          isReordering={'isActive' in params ? params.isActive : false}
          onCopy={copyTable}
          onDrag={'drag' in params ? params.drag : undefined}
          onLeave={leaveTable}
          onPress={openTable}
          onToggleFavorite={toggleFavoriteTable}
          onRename={openRenameTable}
        />
      </View>
    ),
    [
      activeReorderTableId,
      copyTable,
      leaveTable,
      openRenameTable,
      openTable,
      toggleFavoriteTable,
    ],
  );

  const listHeader = (
    <>
      <PageHeader
        title="Tische"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              activeGame && currentTable
                ? 'Tischregeln bearbeiten'
                : 'Profil und Einstellungen öffnen'
            }
            onPress={openSettings}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
          >
            <AppIcon icon={Settings} size="md" color={screenColors.gold} />
          </Pressable>
        }
      />
      <SharedTableConflictNotice />
      {userId ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('TableInvitations')}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <AppText style={{ color: screenColors.gold }}>
            Tischeinladungen ansehen
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.sectionHeader}>
        <AppText style={styles.sectionTitle}>Deine Tische</AppText>
        <AppText style={styles.sectionHint}>
          {visibleTables.length}{' '}
          {visibleTables.length === 1 ? 'Tisch' : 'Tische'}
        </AppText>
      </View>
    </>
  );

  return (
    <AuthBackground
      backgroundPattern={<SchafkopfBackdrop />}
      withEdgeBorder={false}
    >
      {!visibility.hydrated ? (
        <AppText style={{ color: screenColors.muted }}>
          Tische werden geladen …
        </AppText>
      ) : Platform.OS === 'web' || visibleTables.length < 2 ? (
        <FlatList
          contentContainerStyle={styles.content}
          data={visibleTables}
          keyExtractor={(table) => table.id}
          keyboardShouldPersistTaps="handled"
          renderItem={renderTableItem}
          showsVerticalScrollIndicator={false}
          style={styles.scroller}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyGameState
              icon={Spade}
              title="Noch kein Tisch"
              message="Tische, denen du zugeordnet bist, erscheinen hier automatisch. Über das Plus kannst du einen Tisch erstellen."
            />
          }
        />
      ) : (
        <DraggableFlatList
          containerStyle={styles.scroller}
          activationDistance={16}
          animationConfig={{ damping: 22, mass: 0.72, stiffness: 185 }}
          autoscrollSpeed={110}
          autoscrollThreshold={120}
          contentContainerStyle={styles.content}
          data={visibleTables}
          dragItemOverflow
          extraData={activeReorderTableId}
          keyExtractor={(table) => table.id}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          renderItem={renderTableItem}
          scrollEnabled={activeReorderTableId === null}
          showsVerticalScrollIndicator={false}
          style={styles.scroller}
          onDragBegin={handleDragBegin}
          onDragEnd={({ data }) => handleDragEnd(data)}
          onRelease={() => setActiveReorderTableId(null)}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyGameState
              icon={Spade}
              title="Noch kein Tisch"
              message="Tische, denen du zugeordnet bist, erscheinen hier automatisch. Über das Plus kannst du einen Tisch erstellen."
            />
          }
        />
      )}

      {visibility.hydrated ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Neuen Tisch erstellen"
          onPress={openCreateTable}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <AppIcon icon={Plus} size="xl" weight="strong" color="#17150B" />
        </Pressable>
      ) : null}

      <RenameTableSheet
        isFocused={isRenameFocused}
        tableName={renameTable?.name ?? ''}
        value={renameValue}
        visible={renameTable !== null}
        onCancel={closeRenameTable}
        onChangeText={setRenameValue}
        onFocusChange={setIsRenameFocused}
        onSave={saveRenameTable}
      />
      <LeaveTableSheet
        tableName={leaveTableCandidate?.name ?? ''}
        isActive={Boolean(
          (activeGame && leaveTableCandidate?.id === currentTable?.id) ||
          leaveTableCandidate?.hasOpenPayments,
        )}
        visible={leaveTableCandidate !== null}
        onCancel={closeLeaveTable}
        onConfirm={confirmLeaveTable}
      />
    </AuthBackground>
  );
}

type TableCardProps = {
  canReorder?: boolean;
  isDraggingAny: boolean;
  isReordering: boolean;
  table: TablePreview;
  onCopy: (table: TablePreview) => void;
  onDrag?: () => void;
  onLeave: (table: TablePreview) => void;
  onPress: (table: TablePreview) => void;
  onRename: (table: TablePreview) => void;
  onToggleFavorite: (table: TablePreview) => void;
};

const TableCard = memo(function TableCard({
  canReorder = true,
  isDraggingAny,
  isReordering,
  table,
  onCopy,
  onDrag,
  onLeave,
  onPress,
  onRename,
  onToggleFavorite,
}: TableCardProps) {
  const suit = suitTheme[table.suit];
  const SuitIcon = suit.icon;

  return (
    <Animated.View
      exiting={FadeOutLeft.duration(260)}
      style={isReordering && styles.draggingCardWrap}
    >
      <View>
        <ReanimatedSwipeable
          enabled={Platform.OS !== 'web' && !isDraggingAny}
          friction={1.7}
          leftThreshold={42}
          overshootLeft={false}
          overshootRight={false}
          rightThreshold={52}
          renderLeftActions={(_, __, swipeableMethods) => (
            <Pressable
              accessibilityLabel={`${table.name} favorisieren`}
              accessibilityRole="button"
              onPress={() => {
                swipeableMethods.close();
                onToggleFavorite(table);
              }}
              style={({ pressed }) => [
                styles.favoriteAction,
                pressed && styles.swipePressed,
              ]}
            >
              <AppIcon
                icon={Pin}
                size="lg"
                weight="strong"
                color="#17150B"
                fill={table.isFavorite ? authColors.onGold : 'transparent'}
              />
              <AppText style={styles.favoriteActionText}>
                {table.isFavorite ? 'Gepinnt' : 'Pinnen'}
              </AppText>
            </Pressable>
          )}
          renderRightActions={(_, __, swipeableMethods) => (
            <View style={styles.swipeActions}>
              <Pressable
                accessibilityLabel={`${table.name} kopieren`}
                accessibilityRole="button"
                onPress={() => {
                  swipeableMethods.close();
                  onCopy(table);
                }}
                style={({ pressed }) => [
                  styles.swipeAction,
                  styles.copyAction,
                  pressed && styles.swipePressed,
                ]}
              >
                <AppIcon
                  icon={Copy}
                  size="md"
                  weight="strong"
                  color={screenColors.text}
                />
                <AppText style={styles.swipeText}>Kopieren</AppText>
              </Pressable>
              <Pressable
                accessibilityLabel={`${table.name} umbenennen`}
                accessibilityRole="button"
                onPress={() => {
                  swipeableMethods.close();
                  onRename(table);
                }}
                style={({ pressed }) => [
                  styles.swipeAction,
                  styles.renameAction,
                  pressed && styles.swipePressed,
                ]}
              >
                <AppIcon
                  icon={Pencil}
                  size="md"
                  weight="strong"
                  color={screenColors.text}
                />
                <AppText style={styles.swipeText}>Umbenennen</AppText>
              </Pressable>
              <Pressable
                accessibilityLabel={`${table.name} verlassen`}
                accessibilityRole="button"
                onPress={() => {
                  swipeableMethods.close();
                  onLeave(table);
                }}
                style={({ pressed }) => [
                  styles.swipeAction,
                  styles.leaveAction,
                  pressed && styles.swipePressed,
                ]}
              >
                <AppIcon
                  icon={LogOut}
                  size="md"
                  weight="strong"
                  color={screenColors.text}
                />
                <AppText style={styles.swipeText}>Verlassen</AppText>
              </Pressable>
            </View>
          )}
          containerStyle={styles.swipeContainer}
        >
          <View
            style={[
              styles.tableCard,
              table.isCurrent && styles.tableCardCurrent,
              table.isFavorite && styles.tableCardFavorite,
              isReordering && styles.tableCardDragging,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${table.name} oeffnen`}
              disabled={isDraggingAny && !isReordering}
              onPress={() => onPress(table)}
              style={({ pressed }) => [
                styles.tableTapTarget,
                pressed &&
                  (!isDraggingAny || isReordering) &&
                  styles.tablePressed,
              ]}
            >
              <View
                style={[
                  styles.tableSymbol,
                  {
                    backgroundColor: suit.background,
                    borderColor: suit.border,
                    shadowColor: suit.glow,
                  },
                ]}
              >
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0.16)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  pointerEvents="none"
                  style={styles.symbolGloss}
                />
                <AppIcon
                  icon={SuitIcon}
                  size="lg"
                  weight="strong"
                  color={suit.tone}
                />
                <AppText style={[styles.symbolLabel, { color: suit.tone }]}>
                  {suit.label}
                </AppText>
              </View>
              <View style={styles.tableBody}>
                <View style={styles.tableTitleRow}>
                  <AppText style={styles.tableName}>{table.name}</AppText>
                  {table.isFavorite ? (
                    <View style={styles.favoriteBadge}>
                      <AppIcon
                        icon={Pin}
                        size="xs"
                        weight="strong"
                        color={screenColors.gold}
                      />
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.tablePlayers}>
                  {table.players}
                </Text>
                <AppText style={styles.tableDate}>{table.lastPlayed}</AppText>
              </View>
              <AppIcon
                icon={ChevronRight}
                size="md"
                color={screenColors.soft}
              />
            </Pressable>
            {canReorder ? (
              <Pressable
                accessibilityLabel={`${table.name} verschieben`}
                accessibilityRole="button"
                disabled={(isDraggingAny && !isReordering) || !onDrag}
                hitSlop={8}
                delayLongPress={180}
                onLongPress={onDrag}
                style={({ pressed }) => [
                  styles.dragHandle,
                  pressed && styles.dragHandlePressed,
                ]}
              >
                <AppIcon
                  icon={GripVertical}
                  size="md"
                  weight="strong"
                  color={screenColors.gold}
                />
              </Pressable>
            ) : null}
          </View>
        </ReanimatedSwipeable>
      </View>
    </Animated.View>
  );
});

type RenameTableSheetProps = {
  isFocused: boolean;
  tableName: string;
  value: string;
  visible: boolean;
  onCancel: () => void;
  onChangeText: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
  onSave: () => void;
};

function RenameTableSheet({
  isFocused,
  tableName,
  value,
  visible,
  onCancel,
  onChangeText,
  onFocusChange,
  onSave,
}: RenameTableSheetProps) {
  const canSave = value.trim().length > 0;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Animated.View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={styles.dialogCard}>
          <AppText style={styles.sheetTitle}>Umbenennen</AppText>
          <AppText style={styles.sheetSubtitle}>
            Gib {tableName || 'diesem Tisch'} einen neuen Namen.
          </AppText>

          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            keyboardAppearance="dark"
            onBlur={() => onFocusChange(false)}
            onChangeText={onChangeText}
            onFocus={() => onFocusChange(true)}
            placeholder="Tischname"
            placeholderTextColor="rgba(245, 245, 245, 0.34)"
            returnKeyType="done"
            selectionColor={screenColors.gold}
            style={[styles.renameInput, isFocused && styles.renameInputFocus]}
            value={value}
            onSubmitEditing={canSave ? onSave : undefined}
          />

          <View style={styles.sheetActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.sheetButton,
                styles.cancelButton,
                pressed && styles.sheetButtonPressed,
              ]}
            >
              <AppText style={styles.cancelButtonText}>Abbrechen</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!canSave}
              onPress={onSave}
              style={({ pressed }) => [
                styles.sheetButton,
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
                pressed && canSave && styles.sheetButtonPressed,
              ]}
            >
              <AppText style={styles.saveButtonText}>Speichern</AppText>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type LeaveTableSheetProps = {
  tableName: string;
  isActive: boolean;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function LeaveTableSheet({
  tableName,
  isActive,
  visible,
  onCancel,
  onConfirm,
}: LeaveTableSheetProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={styles.dialogCard}>
          <View style={styles.leaveIcon}>
            <AppIcon icon={LogOut} size="lg" weight="strong" color="#DFA0A0" />
          </View>
          <AppText style={styles.sheetTitle}>Tisch verlassen?</AppText>
          <AppText style={styles.sheetSubtitle}>
            Möchtest du {tableName || 'diesen Tisch'} wirklich verlassen?
          </AppText>
          <AppText style={styles.leaveHint}>
            {isActive
              ? 'Dieser Tisch bleibt in deiner Übersicht, solange der Spielabend läuft oder Zahlungen offen sind.'
              : 'Der Tisch wird aus deiner Übersicht entfernt.'}
          </AppText>

          <View style={styles.sheetActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.sheetButton,
                styles.cancelButton,
                pressed && styles.sheetButtonPressed,
              ]}
            >
              <AppText style={styles.cancelButtonText}>Abbrechen</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.sheetButton,
                styles.leaveConfirmButton,
                pressed && styles.sheetButtonPressed,
              ]}
            >
              <AppText style={styles.leaveConfirmText}>Verlassen</AppText>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 128,
    paddingHorizontal: authSpacing.xl,
  },
  scroller: {
    flex: 1,
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(26, 45, 36, 0.72)',
    borderColor: screenColors.border,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    height: authControlSizes.touch,
    justifyContent: 'center',
    width: authControlSizes.touch,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.97 }],
  },
  headerSymbols: {
    height: 0,
    position: 'relative',
  },
  headerSuit: {
    color: 'rgba(242, 201, 76, 0.055)',
    fontSize: 96,
    fontWeight: '800',
    position: 'absolute',
  },
  headerSuitLeft: {
    left: 92,
    top: -72,
    transform: [{ rotate: '-13deg' }],
  },
  headerSuitRight: {
    right: 8,
    top: -88,
    transform: [{ rotate: '12deg' }],
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 2,
  },
  sectionTitle: {
    color: screenColors.text,
    fontSize: authTypography.subhead,
    fontWeight: '700',
  },
  sectionHint: {
    color: screenColors.soft,
    fontSize: authTypography.caption,
    fontWeight: '700',
  },
  tableListItem: {
    marginTop: authSpacing.md,
  },
  draggingCardWrap: {
    elevation: 18,
    shadowColor: screenColors.gold,
    shadowOffset: { height: 22, width: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 30,
    transform: [{ scale: 1.02 }],
    zIndex: 50,
  },
  swipeContainer: { borderRadius: 22, overflow: 'hidden' },
  swipeActions: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
    paddingLeft: 4,
    width: 216,
  },
  swipeAction: {
    alignItems: 'center',
    borderRadius: 14,
    gap: 7,
    justifyContent: 'center',
    width: 68,
    alignSelf: 'stretch',
  },
  favoriteAction: {
    alignItems: 'center',
    backgroundColor: authColors.gold,
    borderRadius: 14,
    gap: 7,
    justifyContent: 'center',
    marginRight: 4,
    width: 68,
    alignSelf: 'stretch',
  },
  favoriteActionText: {
    color: authColors.onGold,
    fontSize: authTypography.micro,
    fontWeight: '600',
  },
  copyAction: { backgroundColor: '#27473E' },
  renameAction: { backgroundColor: '#4D482F' },
  leaveAction: { backgroundColor: authColors.dangerSurface },
  swipePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  swipeText: {
    color: screenColors.text,
    fontSize: authTypography.micro,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableCard: {
    alignItems: 'center',
    backgroundColor: authColors.tableCard,
    borderColor: 'rgba(245,245,245,0.09)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 106,
    padding: 14,
  },
  tableTapTarget: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: authSpacing.md,
    minWidth: 0,
  },
  tablePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.982 }],
  },
  tableCardDragging: {
    borderColor: 'rgba(242, 201, 76, 0.52)',
    elevation: 18,
    shadowColor: screenColors.gold,
    shadowOffset: { height: 20, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
  tableCardCurrent: {
    backgroundColor: authColors.tableCard,
    borderColor: 'rgba(231,198,92,0.27)',
  },
  tableCardFavorite: {
    borderColor: 'rgba(242, 201, 76, 0.28)',
    shadowColor: screenColors.gold,
    shadowOpacity: 0.18,
  },
  tableSymbol: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  symbolGloss: { height: 0 },
  symbolLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  tableBody: {
    flex: 1,
    minWidth: 0,
  },
  dragHandle: {
    alignItems: 'center',
    backgroundColor: 'rgba(242, 201, 76, 0.1)',
    borderColor: 'rgba(242, 201, 76, 0.2)',
    borderRadius: 15,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 34,
  },
  dragHandlePressed: {
    backgroundColor: 'rgba(242, 201, 76, 0.18)',
    transform: [{ scale: 0.96 }],
  },
  tableTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.xs,
  },
  tableName: {
    color: screenColors.text,
    flexShrink: 1,
    fontSize: authTypography.body,
    fontWeight: '700',
    lineHeight: 21,
  },
  favoriteBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(242, 201, 76, 0.12)',
    borderColor: 'rgba(242, 201, 76, 0.22)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  tablePlayers: {
    color: screenColors.muted,
    fontSize: authTypography.control,
    fontWeight: '400',
    lineHeight: 17,
    marginTop: 4,
  },
  tableDate: {
    color: authColors.textMutedGreen,
    fontSize: authTypography.tiny,
    fontWeight: '500',
    marginTop: 7,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: screenColors.gold,
    borderRadius: 27,
    bottom: 132,
    height: 54,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    width: 54,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: authSpacing.xl,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  dialogCard: {
    backgroundColor: authColors.tableCard,
    borderColor: 'rgba(242, 201, 76, 0.18)',
    borderRadius: 32,
    borderWidth: 1,
    gap: authSpacing.md,
    maxWidth: 390,
    padding: authSpacing.xl,
    shadowColor: screenColors.shadow,
    shadowOffset: { height: 20, width: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 30,
    width: '100%',
  },
  sheetTitle: {
    color: screenColors.text,
    fontSize: authTypography.metric,
    fontWeight: '900',
  },
  sheetSubtitle: {
    color: screenColors.muted,
    fontSize: authTypography.caption,
    lineHeight: 20,
  },
  leaveIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(105, 43, 44, 0.34)',
    borderColor: 'rgba(223, 160, 160, 0.2)',
    borderRadius: 24,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  leaveHint: {
    color: screenColors.soft,
    fontSize: authTypography.control,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: -authSpacing.xs,
  },
  renameInput: {
    backgroundColor: authColors.tableBackgroundMid,
    borderColor: 'rgba(245, 245, 245, 0.1)',
    borderRadius: 22,
    borderWidth: 1,
    color: screenColors.text,
    fontSize: authTypography.button,
    fontWeight: '700',
    minHeight: 58,
    paddingHorizontal: authSpacing.lg,
  },
  renameInputFocus: {
    borderColor: screenColors.gold,
    shadowColor: screenColors.gold,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: authSpacing.md,
    marginTop: authSpacing.sm,
  },
  sheetButton: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
  },
  cancelButton: {
    backgroundColor: authColors.borderSoft,
    borderColor: 'rgba(245, 245, 245, 0.1)',
    borderWidth: 1,
  },
  saveButton: {
    backgroundColor: screenColors.gold,
    shadowColor: screenColors.gold,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  saveButtonDisabled: {
    opacity: 0.42,
  },
  leaveConfirmButton: {
    backgroundColor: authColors.dangerSurface,
    shadowColor: authColors.dangerSurface,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  sheetButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  cancelButtonText: {
    color: screenColors.muted,
    fontSize: authTypography.body,
    fontWeight: '900',
  },
  saveButtonText: {
    color: authColors.onGold,
    fontSize: authTypography.body,
    fontWeight: '900',
  },
  leaveConfirmText: {
    color: screenColors.text,
    fontSize: authTypography.body,
    fontWeight: '900',
  },
});
