import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
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
import Animated, { FadeInDown, FadeOutLeft } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { AppText } from '../../components/ui/AppText';
import type { AppStackParamList } from '../../navigation/types';
import { useGameStore } from '../../store/gameStore';
import { authControlSizes, authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { isStockBooking } from '../../utils/accounting';
import {
  areTableOrderIdsEqual,
  sanitizeTableOrderIds,
} from '../../utils/tableOrder';

const screenColors = {
  background: '#0B1D16',
  backgroundMid: '#10241C',
  backgroundSoft: '#163328',
  card: '#1A2D24',
  gold: '#E7C65C',
  text: '#F5F5F5',
  muted: 'rgba(245, 245, 245, 0.62)',
  soft: 'rgba(245, 245, 245, 0.38)',
  border: 'rgba(231, 198, 92, 0.28)',
  shadow: '#000000',
};

const suitTheme = {
  eichel: {
    background: 'rgba(143, 94, 44, 0.22)',
    border: 'rgba(231, 198, 92, 0.26)',
    glow: 'rgba(231, 198, 92, 0.22)',
    icon: Nut,
    label: 'Eichel',
    tone: '#C8944D',
  },
  gras: {
    background: 'rgba(66, 113, 82, 0.24)',
    border: 'rgba(111, 169, 114, 0.24)',
    glow: 'rgba(111, 169, 114, 0.18)',
    icon: Leaf,
    label: 'Gras',
    tone: '#6FA972',
  },
  herz: {
    background: 'rgba(151, 60, 55, 0.22)',
    border: 'rgba(224, 99, 92, 0.24)',
    glow: 'rgba(224, 99, 92, 0.2)',
    icon: Heart,
    label: 'Herz',
    tone: '#E0635C',
  },
  schelle: {
    background: 'rgba(231, 198, 92, 0.2)',
    border: 'rgba(231, 198, 92, 0.28)',
    glow: 'rgba(231, 198, 92, 0.24)',
    icon: Bell,
    label: 'Schelle',
    tone: '#E7C65C',
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
  const [removedTableIds, setRemovedTableIds] = useState<string[]>([]);
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
        lastPlayed: `${day.rounds.filter((round) => !isStockBooking(round)).length} Spiele · ${openPayments > 0 ? `${openPayments} Zahlungen offen` : 'Abgerechnet'}`,
        suit: 'schelle',
        isCurrent: false,
        hasOpenPayments: openPayments > 0,
        isFavorite: day.table.isFavorite,
        sortOrder: day.table.sortOrder,
      };
    });
    // Prefer the archived snapshot for a completed table, without duplicating it.
    return createUniqueTables(
      activeGame
        ? [...tables, ...archivedTables]
        : [...archivedTables, ...tables],
    );
  }, [activeGame, archivedGameDays, currentTable, players]);

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
          !removedTableIds.includes(table.id),
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
    navigation.navigate(
      activeGame && currentTable ? 'ActiveGame' : 'CreateTable',
    );
  }, [activeGame, currentTable, navigation]);

  const openTable = useCallback(
    (table: TablePreview) => {
      if (table.id === currentTable?.id && activeGame) {
        navigation.navigate('ActiveGame');
      } else if (
        archivedGameDays.some((day) => day.table.id === table.id) ||
        table.id === currentTable?.id
      ) {
        navigation.navigate('Settlement', { tableId: table.id });
      }
    },
    [activeGame, archivedGameDays, currentTable?.id, navigation],
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
    setRemovedTableIds((current) =>
      current.includes(tableId) ? current : [...current, tableId],
    );
  }, [activeGame, currentTable?.id, leaveTableCandidate]);

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
      <View style={styles.header}>
        <View>
          <AppText style={styles.kicker}>Spiel</AppText>
          <AppText style={styles.title}>Tische</AppText>
        </View>
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
          <Settings color={screenColors.gold} size={20} strokeWidth={2.2} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(420)} style={styles.hero}>
        <BlurView intensity={18} tint="dark" style={styles.heroBlur}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Spade color={screenColors.gold} size={26} strokeWidth={2.3} />
            </View>
            <View style={styles.heroCopyWrap}>
              <AppText style={styles.heroTitle}>
                {activeGame && currentTable
                  ? 'Dein Spielabend läuft'
                  : 'Neue Runde starten'}
              </AppText>
              <AppText style={styles.heroCopy}>
                {activeGame && currentTable
                  ? 'Dein Tisch ist gespeichert. Spielt einfach weiter.'
                  : 'Richte deinen Tisch für den nächsten Spielabend ein.'}
              </AppText>
            </View>
          </View>
          <GoldButton
            title={
              activeGame && currentTable
                ? 'Am Tisch weiterspielen'
                : 'Tisch erstellen'
            }
            onPress={openCreateTable}
          />
        </BlurView>
      </Animated.View>

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
    <AuthBackground>
      <LinearGradient
        colors={[
          screenColors.background,
          screenColors.backgroundMid,
          screenColors.backgroundSoft,
        ]}
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {Platform.OS === 'web' || visibleTables.length < 2 ? (
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
              message="Erstelle deinen ersten Tisch mit dem Button oben."
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
              message="Erstelle deinen ersten Tisch mit dem Button oben."
            />
          }
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          activeGame && currentTable
            ? 'Am Tisch weiterspielen'
            : 'Neuen Tisch erstellen'
        }
        onPress={openCreateTable}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        {activeGame && currentTable ? (
          <ChevronRight color="#17150B" size={28} strokeWidth={2.8} />
        ) : (
          <Plus color="#17150B" size={28} strokeWidth={2.8} />
        )}
      </Pressable>

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
              <Pin
                color="#17150B"
                fill={table.isFavorite ? '#17150B' : 'transparent'}
                size={22}
                strokeWidth={2.5}
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
                <Copy color={screenColors.text} size={20} strokeWidth={2.4} />
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
                <Pencil color={screenColors.text} size={20} strokeWidth={2.4} />
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
                <LogOut color={screenColors.text} size={20} strokeWidth={2.4} />
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
                <SuitIcon color={suit.tone} size={25} strokeWidth={2.35} />
                <AppText style={[styles.symbolLabel, { color: suit.tone }]}>
                  {suit.label}
                </AppText>
              </View>
              <View style={styles.tableBody}>
                <View style={styles.tableTitleRow}>
                  <AppText style={styles.tableName}>{table.name}</AppText>
                  {table.isFavorite ? (
                    <View style={styles.favoriteBadge}>
                      <Pin
                        color={screenColors.gold}
                        size={12}
                        strokeWidth={2.5}
                      />
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.tablePlayers}>
                  {table.players}
                </Text>
                <AppText style={styles.tableDate}>{table.lastPlayed}</AppText>
              </View>
              <ChevronRight
                color={screenColors.soft}
                size={20}
                strokeWidth={2.2}
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
                <GripVertical
                  color={screenColors.gold}
                  size={20}
                  strokeWidth={2.3}
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
            <LogOut color="#DFA0A0" size={24} strokeWidth={2.4} />
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
    paddingTop: authSpacing.lg,
  },
  scroller: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 68,
  },
  kicker: {
    color: screenColors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    color: screenColors.text,
    fontSize: 32,
    fontWeight: '700',
    marginTop: 4,
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
    color: 'rgba(231, 198, 92, 0.055)',
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
  hero: { borderRadius: 22, marginTop: 16 },
  heroBlur: {
    backgroundColor: 'rgba(26,45,36,0.84)',
    borderColor: 'rgba(231,198,92,0.17)',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(231,198,92,0.08)',
    borderRadius: 15,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroCopyWrap: {
    flex: 1,
  },
  heroTitle: { color: screenColors.text, fontSize: 18, fontWeight: '700' },
  heroCopy: {
    color: screenColors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 2,
  },
  sectionTitle: { color: screenColors.text, fontSize: 18, fontWeight: '700' },
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
    backgroundColor: '#C5AA54',
    borderRadius: 14,
    gap: 7,
    justifyContent: 'center',
    marginRight: 4,
    width: 68,
    alignSelf: 'stretch',
  },
  favoriteActionText: { color: '#172219', fontSize: 10, fontWeight: '600' },
  copyAction: { backgroundColor: '#27473E' },
  renameAction: { backgroundColor: '#4D482F' },
  leaveAction: { backgroundColor: '#563535' },
  swipePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  swipeText: {
    color: screenColors.text,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableCard: {
    alignItems: 'center',
    backgroundColor: '#1A3025',
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
    borderColor: 'rgba(231, 198, 92, 0.52)',
    elevation: 18,
    shadowColor: screenColors.gold,
    shadowOffset: { height: 20, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
  tableCardCurrent: {
    backgroundColor: '#1C3327',
    borderColor: 'rgba(231,198,92,0.27)',
  },
  tableCardFavorite: {
    borderColor: 'rgba(231, 198, 92, 0.28)',
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
    backgroundColor: 'rgba(231, 198, 92, 0.1)',
    borderColor: 'rgba(231, 198, 92, 0.2)',
    borderRadius: 15,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 34,
  },
  dragHandlePressed: {
    backgroundColor: 'rgba(231, 198, 92, 0.18)',
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
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  favoriteBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(231, 198, 92, 0.12)',
    borderColor: 'rgba(231, 198, 92, 0.22)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  tablePlayers: {
    color: screenColors.muted,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    marginTop: 4,
  },
  tableDate: {
    color: '#A4B99C',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 7,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: screenColors.gold,
    borderRadius: 27,
    bottom: 116,
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
    backgroundColor: '#1A2D24',
    borderColor: 'rgba(231, 198, 92, 0.18)',
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
    fontSize: 24,
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
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: -authSpacing.xs,
  },
  renameInput: {
    backgroundColor: '#10241C',
    borderColor: 'rgba(245, 245, 245, 0.1)',
    borderRadius: 22,
    borderWidth: 1,
    color: screenColors.text,
    fontSize: 17,
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
    backgroundColor: 'rgba(245, 245, 245, 0.08)',
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
    backgroundColor: '#692B2C',
    shadowColor: '#692B2C',
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
    fontSize: 16,
    fontWeight: '900',
  },
  saveButtonText: {
    color: '#17150B',
    fontSize: 16,
    fontWeight: '900',
  },
  leaveConfirmText: {
    color: screenColors.text,
    fontSize: 16,
    fontWeight: '900',
  },
});
