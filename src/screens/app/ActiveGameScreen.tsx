import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Ellipsis,
  History,
  ListOrdered,
  Menu,
  ReceiptText,
  SlidersHorizontal,
  Trash2,
  UsersRound,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type ListRenderItem,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { EuroStyleCoin } from '../../components/game/EuroStyleCoin';
import { GameActionButton } from '../../components/game/GameActionButton';
import {
  historyColumnWidths,
  MatchHistoryCard,
} from '../../components/game/MatchHistoryCard';
import { PlayerActionsMenu } from '../../components/game/PlayerActionsMenu';
import {
  quickRoundDraftPlayer,
  RoundEntrySheet,
} from '../../components/game/RoundEntrySheet';
import { RoundHistoryActions } from '../../components/game/RoundHistoryActions';
import { RoundHistoryModal } from '../../components/game/RoundHistoryView';
import { RoundUndoNotice } from '../../components/game/RoundUndoNotice';
import { SharedTablePanel } from '../../components/game/SharedTablePanel';
import { SyncStatus } from '../../components/game/SyncStatus';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { AppText } from '../../components/ui/AppText';
import { PROFILE_ACCENTS } from '../../constants/profileCustomization';
import { useAccountProfiles } from '../../hooks/useAccountProfiles';
import { appAlert } from '../../lib/appAlert';
import type { AppStackScreenProps } from '../../navigation/types';
import { reliableStorage } from '../../storage/reliableStorage';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authRadius, authSpacing } from '../../theme/spacing';
import type { GameRound, Player, PlayerBalance } from '../../types/game';
import type { AnimalAvatarId, ProfileCard } from '../../types/profile';
import {
  getStockBalanceCents,
  isCustomBooking,
  isPlayedRound,
  isStockBooking,
  roundWinnerIds,
} from '../../utils/accounting';
import { formatRoundGameType } from '../../utils/cardSuits';
import {
  getCurrentDealerId,
  getNextDealerId,
  hasPendingMisdeal,
  roundPlayers,
} from '../../utils/dealerOrder';
import { outstandingBalances } from '../../utils/interimPayments';
import { canOpenQuickRound } from '../../utils/quickRound';
import { roundHistoryFingerprint } from '../../utils/roundHistory';
import { tableAccess } from '../../utils/tableAccess';

type ActiveGameScreenProps = AppStackScreenProps<'ActiveGame'>;
type ActiveTab = 'players' | 'history';

type RankedPlayer = {
  isPaused?: boolean;
  accentColor: string;
  amount: number;
  animalId: AnimalAvatarId;
  id: string;
  isLeader: boolean;
  name: string;
  placedCoins: number;
  rank: number;
  seatIndex: number;
};

const screenColors = {
  background: '#07110B',
  backgroundMid: '#0B1D16',
  backgroundSoft: '#143126',
  card: 'rgba(20, 42, 32, 0.72)',
  cardStrong: 'rgba(27, 51, 40, 0.92)',
  gold: '#E7C65C',
  goldSoft: 'rgba(231, 198, 92, 0.14)',
  red: '#E58B8B',
  redSoft: 'rgba(229, 139, 139, 0.13)',
  text: '#F5F5F5',
  muted: 'rgba(245, 245, 245, 0.64)',
  soft: 'rgba(245, 245, 245, 0.58)',
  border: 'rgba(231, 198, 92, 0.22)',
  shadow: '#000000',
};

const playerAnimals: AnimalAvatarId[] = [
  'fox',
  'bear',
  'owl',
  'wolf',
  'deer',
  'rabbit',
  'boar',
];
const playerAccents = [
  PROFILE_ACCENTS.forestGreen,
  PROFILE_ACCENTS.amber,
  PROFILE_ACCENTS.mutedBlue,
  PROFILE_ACCENTS.warmRed,
  PROFILE_ACCENTS.bronze,
  PROFILE_ACCENTS.darkGreen,
];
const touchHitSlop = { bottom: 8, left: 8, right: 8, top: 8 };
const maxPlacedCoins = 4;

function triggerSelectionHaptic() {
  void Haptics.selectionAsync();
}

function triggerSaveHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

type FinishDialog =
  | { kind: 'archive' }
  | { kind: 'stock'; potCents: number }
  | { kind: 'message'; title: string; message: string };

function formatAmount(amount: number) {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

function getPlayerVisual(index: number) {
  return {
    accentColor: playerAccents[index % playerAccents.length],
    animalId: playerAnimals[index % playerAnimals.length],
  };
}

export function ActiveGameScreen({ navigation, route }: ActiveGameScreenProps) {
  const insets = useSafeAreaInsets();
  const currentTable = useGameStore((state) => state.currentTable);
  const actorId = useAuthStore((state) => state.user?.id);
  const { canWrite, canManage } = tableAccess(currentTable, actorId);
  const players = useGameStore((state) => state.players);
  const setPlayerOrder = useGameStore((state) => state.setPlayerOrder);
  const setTurboRamsch = useGameStore((state) => state.setTurboRamsch);
  const togglePlayerLeger = useGameStore((state) => state.togglePlayerLeger);
  const turboRamschEnabled = currentTable?.turboRamschEnabled ?? false;
  const rounds = useGameStore((state) => state.rounds);
  const balances = useGameStore((state) => state.balances);
  const finishGameDay = useGameStore((state) => state.finishGameDay);
  const persistGame = useGameStore((state) => state.persistGame);
  const scrollPositions = useRef({ players: 0, history: 0 });
  const leavingRef = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [roundSaved, setRoundSaved] = useState(false);
  const [scrollOffsets, setScrollOffsets] = useState({
    players: 0,
    history: 0,
  });
  const [menuVisible, setMenuVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [undoTarget, setUndoTarget] = useState<{
    tableId: string;
    eventId: string;
    action: 'created' | 'updated' | 'deleted' | 'restored';
  } | null>(null);
  const appliedUndo = useRef<string | undefined>(undefined);
  const dismissUndo = useCallback(() => {
    appliedUndo.current = undefined;
    setUndoTarget(null);
  }, []);
  const showUndo = useCallback((eventId?: string) => {
    appliedUndo.current = undefined;
    const table = useGameStore.getState().currentTable;
    const event = table?.roundHistory?.find((e) => e.id === eventId);
    if (table && event)
      setUndoTarget({
        tableId: table.id,
        eventId: event.id,
        action: event.action,
      });
    else setUndoTarget(null);
  }, []);
  useEffect(
    () =>
      useGameStore.subscribe((state, previous) => {
        if (state.currentTable?.id !== previous.currentTable?.id) dismissUndo();
      }),
    [dismissUndo],
  );
  const restoreRound = useCallback(
    (roundId: string, expectedEventId?: string) => {
      const tableId = currentTable?.id;
      if (
        !tableId ||
        !useGameStore.getState().restoreRound(tableId, roundId, expectedEventId)
      )
        return (
          useGameStore.getState().roundError ??
          'Das Spiel konnte nicht wiederhergestellt werden.'
        );
      dismissUndo();
      triggerSaveHaptic();
      return undefined;
    },
    [currentTable?.id, dismissUndo],
  );
  const [seatOrderVisible, setSeatOrderVisible] = useState(false);
  const [playerActions, setPlayerActions] = useState<{
    tableId: string;
    playerId: string | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('players');
  const [draggingPlayers, setDraggingPlayers] = useState(false);
  const dragTableId = useRef<string | undefined>(undefined);
  const [roundComposerVisible, setRoundComposerVisible] = useState(false);
  const [composerSession, setComposerSession] = useState(0);
  const [initialDeclarerId, setInitialDeclarerId] = useState<
    string | undefined
  >();
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [undoConfirmVisible, setUndoConfirmVisible] = useState(false);
  // Rendered in-app so it also works on react-native-web.
  const [finishDialog, setFinishDialog] = useState<FinishDialog | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<{
    tableId: string;
    roundId: string;
    eventId?: string;
    fingerprint: string;
    fromHistory: boolean;
  } | null>(null);
  const pendingDeletion = useRef<string | undefined>(undefined);
  const deletionLock = useRef(false);
  const [deletionSaving, setDeletionSaving] = useState(false);
  const [deletionError, setDeletionError] = useState('');
  const editingRound =
    rounds.find((round) => round.id === editingRoundId) ?? null;
  const placedCoinsByPlayerId = useMemo<Record<string, number>>(
    () =>
      Object.fromEntries(
        (currentTable?.placedLegerPlayerIds ?? []).map((id) => [id, 1]),
      ),
    [currentTable?.placedLegerPlayerIds],
  );

  const accountProfiles = useAccountProfiles(
    players.flatMap((player) => (player.userId ? [player.userId] : [])),
  );
  const rankedPlayers = useMemo(
    () =>
      createRankedPlayers(
        players,
        outstandingBalances(balances, currentTable?.interimPayments),
        placedCoinsByPlayerId,
      ),
    [balances, placedCoinsByPlayerId, players, currentTable?.interimPayments],
  );
  const currentDealerId = getCurrentDealerId(
    currentTable,
    players,
    rounds.length,
  );
  const participantIds = new Set(
    roundPlayers(currentTable, players, rounds.length).map((p) => p.id),
  );
  const nextDealerId = getNextDealerId(currentTable, players, rounds.length);
  const dealerName =
    players.find(({ id }) => id === currentDealerId)?.name ?? '–';
  const nextDealerName =
    players.find(({ id }) => id === nextDealerId)?.name ?? '–';
  const recentRounds = useMemo(() => [...rounds].reverse(), [rounds]);
  const playedRounds = rounds.filter(isPlayedRound).length;
  const placedCoinCount = useMemo(
    () =>
      Math.min(
        maxPlacedCoins,
        Object.values(placedCoinsByPlayerId).reduce(
          (sum, coinCount) => sum + normalizeCoinCount(coinCount),
          0,
        ),
      ),
    [placedCoinsByPlayerId],
  );
  const roundMultiplier =
    (currentTable?.settings.bonusRules.leger.enabled
      ? currentTable.settings.bonusRules.leger.value ** placedCoinCount
      : 1) * (turboRamschEnabled ? 2 : 1);
  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );

  const getPlayerName = useCallback(
    (id: string) => playerNameById.get(id) ?? 'Unbekannt',
    [playerNameById],
  );

  const editRound = useCallback((round: GameRound) => {
    if (
      !tableAccess(
        useGameStore.getState().currentTable,
        useAuthStore.getState().user?.id,
      ).canWrite
    )
      return;
    setComposerSession((value) => value + 1);
    setInitialDeclarerId(undefined);
    setEditingRoundId(round.id);
    setRoundComposerVisible(true);
  }, []);
  useEffect(() => {
    const id = route?.params?.roundId;
    if (!id) return;
    // Deliver the navigation request after its render has committed.
    const timer = setTimeout(() => {
      const round = rounds.find((r) => r.id === id);
      if (
        round &&
        (!round.stockAction ||
          ['deposit', 'payout', 'double'].includes(round.stockAction))
      )
        editRound(round);
      navigation.setParams({ roundId: undefined });
    }, 0);
    return () => clearTimeout(timer);
  }, [route?.params?.roundId, rounds, editRound, navigation]);
  const requestRoundDeletion = useCallback(
    (round: GameRound, fromHistory: boolean) => {
      const table = useGameStore.getState().currentTable;
      if (!table || table.id !== round.tableId) return;
      setDeleteCandidate({
        tableId: table.id,
        roundId: round.id,
        eventId: table.roundHistory
          ?.filter((event) => event.roundId === round.id)
          .at(-1)?.id,
        fingerprint: roundHistoryFingerprint(round),
        fromHistory,
      });
      pendingDeletion.current = undefined;
      setDeletionError('');
      setMenuVisible(false);
      setUndoConfirmVisible(true);
    },
    [],
  );
  const renderHistoryRound: ListRenderItem<GameRound> = useCallback(
    ({ item }) =>
      currentTable ? (
        <RoundHistoryActions
          table={currentTable}
          players={players}
          rounds={rounds}
          round={item}
          onDelete={
            canWrite &&
            !['carryIn', 'carryOut', 'refund'].includes(item.stockAction ?? '')
              ? () => requestRoundDeletion(item, true)
              : undefined
          }
          onEdit={
            canWrite &&
            !item.misdealPlayerId &&
            (!item.stockAction ||
              ['deposit', 'payout', 'double'].includes(item.stockAction))
              ? () => editRound(item)
              : undefined
          }
        >
          <HistoryRoundRow
            round={item}
            roundNumber={rounds.findIndex((round) => round.id === item.id) + 1}
            stockPayoutCents={
              item.stockAction === 'payout'
                ? getStockBalanceCents(
                    rounds.slice(
                      0,
                      rounds.findIndex((round) => round.id === item.id),
                    ),
                  )
                : 0
            }
            getPlayerName={getPlayerName}
          />
        </RoundHistoryActions>
      ) : null,
    [
      getPlayerName,
      editRound,
      rounds,
      currentTable,
      players,
      canWrite,
      requestRoundDeletion,
    ],
  );

  const keyExtractorRound = useCallback((round: GameRound) => round.id, []);

  const renderHistorySeparator = useCallback(
    () => <View style={styles.historySeparator} />,
    [],
  );

  const showPlayersTab = useCallback(() => {
    if (activeTab !== 'players') {
      triggerSelectionHaptic();
    }

    setScrollOffsets({ ...scrollPositions.current });
    setActiveTab('players');
  }, [activeTab]);

  const showHistoryTab = useCallback(() => {
    if (activeTab !== 'history') {
      triggerSelectionHaptic();
    }

    setScrollOffsets({ ...scrollPositions.current });
    setActiveTab('history');
  }, [activeTab]);

  const openRoundComposer = useCallback((declarerId?: string) => {
    const state = useGameStore.getState();
    if (
      !tableAccess(state.currentTable, useAuthStore.getState().user?.id)
        .canWrite
    )
      return;
    if (
      declarerId &&
      !roundPlayers(
        state.currentTable,
        state.players,
        state.rounds.length,
      ).some((p) => p.id === declarerId)
    )
      return;
    setComposerSession((value) => value + 1);
    triggerSelectionHaptic();
    setRoundSaved(false);
    setInitialDeclarerId(declarerId);
    setEditingRoundId(null);
    setRoundComposerVisible(true);
  }, []);

  useEffect(() => {
    const request = route?.params?.quickRound;
    if (!request || !navigation.isFocused()) return;
    if (roundComposerVisible) {
      navigation.setParams({ quickRound: undefined });
      return;
    }
    if (
      request === true ||
      currentTable?.id !== request ||
      !canOpenQuickRound(
        currentTable,
        players,
        useGameStore.getState().activeGame,
        actorId,
      )
    ) {
      navigation.setParams({ quickRound: undefined });
      navigation.navigate('QuickRound');
      return;
    }
    let cancelled = false;
    void quickRoundDraftPlayer(currentTable, players, rounds, actorId!).then(
      (id) => {
        if (cancelled || !navigation.isFocused()) return;
        const state = useGameStore.getState();
        const userId = useAuthStore.getState().user?.id;
        navigation.setParams({ quickRound: undefined });
        if (
          state.currentTable?.id === request &&
          canOpenQuickRound(
            state.currentTable,
            state.players,
            state.activeGame,
            userId,
          )
        ) {
          openRoundComposer(id);
        } else {
          navigation.navigate('QuickRound');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    actorId,
    currentTable,
    navigation,
    openRoundComposer,
    players,
    roundComposerVisible,
    rounds,
    route?.params?.quickRound,
  ]);

  const closeRoundComposer = useCallback(() => {
    triggerSelectionHaptic();
    setRoundComposerVisible(false);
  }, []);

  const completeFinish = useCallback(
    (resolution?: 'refund' | 'carry') => {
      const store = useGameStore.getState();
      const finishedTableId = store.currentTable?.id;
      if (
        resolution === 'refund' &&
        !store.players.some((player) => !player.isPaused)
      ) {
        setFinishDialog({
          kind: 'message',
          title: 'Kein aktiver Spieler',
          message:
            'Bitte zuerst einen Spieler wieder aktivieren, damit der Stock verteilt werden kann.',
        });
        return;
      }
      if (!finishGameDay(resolution)) {
        setFinishDialog({
          kind: 'message',
          title: 'Abschluss nicht möglich',
          message:
            useGameStore.getState().finishError ??
            'Bitte prüfe den aktiven Tisch und seine Rundeneinträge. Ungültige Abrechnungsdaten werden nicht abgeschlossen.',
        });
        return;
      }
      setFinishDialog(null);
      if (finishedTableId) {
        navigation.navigate('Settlement', { tableId: finishedTableId });
      }
    },
    [finishGameDay, navigation],
  );

  const finishDay = useCallback(() => {
    triggerSelectionHaptic();
    const pot = getStockBalanceCents(useGameStore.getState().rounds);
    if (pot > 0) setFinishDialog({ kind: 'stock', potCents: pot });
    else completeFinish();
  }, [completeFinish]);

  const confirmArchiveTable = useCallback(() => {
    triggerSelectionHaptic();
    setFinishDialog({ kind: 'archive' });
  }, []);

  const openTableSettings = useCallback(() => {
    triggerSelectionHaptic();
    navigation.navigate('EditTable');
  }, [navigation]);

  const goToTablesOverview = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    triggerSelectionHaptic();
    try {
      await persistGame();
      navigation.navigate('AppTabs', { screen: 'GameLobby' });
    } catch {
      appAlert(
        'Speichern fehlgeschlagen',
        'Dein Spiel bleibt geöffnet. Bitte versuche es erneut.',
      );
    } finally {
      leavingRef.current = false;
      setLeaving(false);
    }
  }, [navigation, persistGame]);

  const togglePlacedCoin = useCallback(
    (playerId: string) => {
      triggerSelectionHaptic();
      togglePlayerLeger(playerId);
    },
    [togglePlayerLeger],
  );

  const replaceWithCreateTable = useCallback(() => {
    navigation.replace('CreateTable');
  }, [navigation]);

  if (!currentTable) {
    return (
      <AuthBackground>
        <View style={styles.center}>
          <EmptyGameState
            icon={ReceiptText}
            title="Kein Spieltisch aktiv"
            message="Erstelle zuerst einen Tisch, um Runden zu erfassen."
          />
          <GoldButton
            title="Tisch erstellen"
            onPress={replaceWithCreateTable}
          />
        </View>
      </AuthBackground>
    );
  }

  const tableOverviewHeader = (
    <>
      <Animated.View style={styles.topBar}>
        <Pressable
          accessibilityHint="Kehrt zur Tische-Übersicht zurück, ohne den Spieltag zu beenden"
          accessibilityLabel="Zurück zu Tische"
          accessibilityRole="button"
          hitSlop={touchHitSlop}
          disabled={leaving}
          accessibilityState={{ busy: leaving, disabled: leaving }}
          onPress={goToTablesOverview}
          style={({ pressed }) => [
            styles.navPill,
            styles.backPill,
            pressed && styles.pressed,
          ]}
        >
          <ArrowLeft color={screenColors.gold} size={20} strokeWidth={2.2} />
          <AppText style={styles.navPillText}>
            {leaving ? 'Speichert …' : 'Tische'}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityLabel="Tischmenü öffnen"
          accessibilityRole="button"
          onPress={() => setMenuVisible(true)}
          style={styles.menuButton}
        >
          <Ellipsis color={screenColors.gold} size={24} />
        </Pressable>
      </Animated.View>

      <Animated.View style={styles.tableHeader}>
        <View style={styles.tableTitleBlock}>
          <Text style={styles.title}>{currentTable.name}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <AppText style={styles.statusText}>
              {currentTable.shared && !canWrite ? 'Nur lesen' : 'Runde läuft'}
            </AppText>
            <AppText style={styles.playerCount}>
              {players.length} Spieler
            </AppText>
          </View>
        </View>
      </Animated.View>

      <View style={styles.compactStats}>
        <View style={styles.statChip}>
          <AppText style={styles.statChipLabel}>Spiel Nr.</AppText>
          <Text style={styles.statChipValue}>{playedRounds + 1}</Text>
        </View>
        <View style={styles.statChip}>
          <AppText style={styles.statChipLabel}>Geber</AppText>
          <Text
            style={styles.statChipValue}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {dealerName}
          </Text>
        </View>
        <View style={styles.statChip}>
          <AppText style={styles.statChipLabel}>Danach</AppText>
          <Text
            style={styles.statChipValue}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {nextDealerName}
          </Text>
        </View>
      </View>

      <SegmentedTabs
        activeTab={activeTab}
        onShowHistory={showHistoryTab}
        onShowPlayers={showPlayersTab}
      />
    </>
  );

  const finishDayButton = canManage ? (
    <GameActionButton
      accessibilityHint="Schliesst den Spieltag ab und zeigt die Abrechnung"
      accessibilityLabel="Spieltag abschliessen"
      hitSlop={touchHitSlop}
      onPress={finishDay}
      style={styles.finishButton}
      title="Spieltag abschließen"
    />
  ) : null;

  return (
    <AuthBackground>
      <LinearGradient
        colors={[
          screenColors.background,
          screenColors.backgroundMid,
          screenColors.backgroundSoft,
        ]}
        locations={[0, 0.52, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      {activeTab === 'history' ? (
        <FlatList
          style={styles.scroller}
          contentContainerStyle={[styles.content, { paddingBottom: 16 }]}
          contentOffset={{ x: 0, y: scrollOffsets.history }}
          onScroll={(event) => {
            scrollPositions.current.history = event.nativeEvent.contentOffset.y;
          }}
          data={recentRounds}
          initialNumToRender={12}
          ItemSeparatorComponent={renderHistorySeparator}
          keyExtractor={keyExtractorRound}
          keyboardShouldPersistTaps="handled"
          maxToRenderPerBatch={10}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={renderHistoryRound}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          ListEmptyComponent={
            <EmptyGameState
              icon={ReceiptText}
              title="Noch keine Runden"
              message="Wechsle zu Spieler und tippe auf den Ansager, um das erste Spiel zu erfassen."
            />
          }
          ListFooterComponent={
            <View>
              <SharedTablePanel issuesOnly />
              <SyncStatus />
            </View>
          }
          ListHeaderComponent={
            <>
              {tableOverviewHeader}
              <Animated.View style={[styles.stack, styles.historyHeaderStack]}>
                <View style={styles.sectionHeader}>
                  <View>
                    <AppText style={styles.sectionTitle}>Spielverlauf</AppText>
                    <AppText style={styles.sectionSubtitle}>
                      Zeile antippen für Bearbeitung und Verlauf
                    </AppText>
                  </View>
                </View>
                <View style={styles.historyColumns}>
                  <AppText
                    style={[
                      styles.columnLabel,
                      { width: historyColumnWidths.number },
                    ]}
                  >
                    Nr.
                  </AppText>
                  <AppText
                    style={[
                      styles.columnLabel,
                      { width: historyColumnWidths.game },
                    ]}
                  >
                    Spiel
                  </AppText>
                  <AppText style={[styles.columnLabel, { flex: 1 }]}>
                    Ergebnis
                  </AppText>
                  <AppText
                    style={[
                      styles.columnLabel,
                      { width: historyColumnWidths.amount, textAlign: 'right' },
                    ]}
                  >
                    Betrag
                  </AppText>
                </View>
              </Animated.View>
            </>
          }
        />
      ) : (
        <DraggableFlatList<RankedPlayer>
          testID="player-standings-list"
          containerStyle={styles.scroller}
          activationDistance={8}
          onDragBegin={() => {
            dragTableId.current = useGameStore.getState().currentTable?.id;
            setDraggingPlayers(true);
            triggerSelectionHaptic();
          }}
          onDragEnd={({ data }) => {
            setDraggingPlayers(false);
            if (
              dragTableId.current !==
                useGameStore.getState().currentTable?.id ||
              !setPlayerOrder(data.map((p) => p.id))
            )
              appAlert(
                'Reihenfolge nicht gespeichert',
                'Der Tisch oder die Spieler haben sich geändert. Bitte erneut versuchen.',
              );
          }}
          data={rankedPlayers}
          keyExtractor={(player) => player.id}
          style={styles.scroller}
          contentContainerStyle={[styles.content, { paddingBottom: 16 }]}
          contentOffset={{ x: 0, y: scrollOffsets.players }}
          onScrollOffsetChange={(offset) => {
            scrollPositions.current.players = offset;
          }}
          scrollEnabled
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {tableOverviewHeader}
              {participantIds.size !== 4 ? (
                <AppText style={styles.dragHint}>
                  Mindestens vier aktive Spieler erforderlich
                </AppText>
              ) : null}
              <View style={[styles.stack, styles.dragTableHeader]}>
                <View style={styles.playerTableHeader}>
                  <View style={[styles.nameColumn, styles.orderHeader]}>
                    <AppText style={styles.columnLabel}>Spieler</AppText>
                    <Pressable
                      accessibilityLabel="Sitzreihenfolge ändern"
                      disabled={!canManage}
                      accessibilityRole="button"
                      onPress={() => setSeatOrderVisible(true)}
                      style={styles.orderIcon}
                    >
                      <ListOrdered size={18} color={screenColors.gold} />
                    </Pressable>
                  </View>
                  <AppText style={[styles.columnLabel, styles.balanceColumn]}>
                    Offen
                  </AppText>
                  <AppText style={[styles.columnLabel, styles.coinColumn]}>
                    Leger
                  </AppText>
                  <View style={styles.dragHandle} />
                </View>
              </View>
            </>
          }
          renderItem={({ item: player, drag, isActive }) => (
            <View style={styles.dragTableRow}>
              <PlayerRankingRow
                participating={participantIds.has(player.id)}
                dragging={draggingPlayers || isActive || !canWrite}
                canReorder={canManage}
                onDrag={canManage ? drag : () => {}}
                isDealer={player.id === currentDealerId}
                hasMisdeal={Boolean(
                  currentTable?.settings.misdealPenaltyEnabled &&
                  hasPendingMisdeal(currentTable, rounds, player.id),
                )}
                player={player}
                profileCard={
                  accountProfiles[
                    players.find((p) => p.id === player.id)?.userId ?? ''
                  ]
                }
                onPressPlayer={(player) => openRoundComposer(player.id)}
                onPressCoin={togglePlacedCoin}
                onOpenActions={() =>
                  canManage &&
                  currentTable &&
                  setPlayerActions({
                    tableId: currentTable.id,
                    playerId: player.id,
                  })
                }
              />
            </View>
          )}
          ListFooterComponent={
            <View>
              <View style={styles.dragTableEnd} />
              <AppText style={styles.dragHint}>
                Griff gedrückt halten und ziehen oder Listensymbol nutzen ·
                Spielernamen für Aktionen gedrückt halten
              </AppText>
              {outstandingBalances(
                balances,
                currentTable?.interimPayments,
              ).every((balance) => balance.amount === 0) ? (
                <AppText style={styles.balancedHint}>
                  Alle offenen Beträge ausgeglichen
                </AppText>
              ) : null}
              <View
                style={[
                  styles.turboCard,
                  turboRamschEnabled && styles.turboCardActive,
                ]}
              >
                <View style={styles.turboCopy}>
                  <AppText style={styles.turboTitle}>Turbo Ramsch</AppText>
                  <AppText style={styles.turboHint}>
                    Spielwert ×2, zusätzlich zu den Legern
                  </AppText>
                </View>
                <Switch
                  accessibilityLabel="Turbo Ramsch"
                  disabled={!canWrite}
                  accessibilityHint="Verdoppelt den Spielwert zusätzlich zu den Legern"
                  value={turboRamschEnabled}
                  onValueChange={setTurboRamsch}
                  thumbColor="#F5F5F5"
                  ios_backgroundColor="#3B4C42"
                  trackColor={{ false: '#3B4C42', true: '#6FA972' }}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zwischenabrechnung öffnen"
                onPress={() =>
                  currentTable &&
                  navigation.navigate('Settlement', {
                    tableId: currentTable.id,
                  })
                }
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <AppText
                  style={{ color: screenColors.gold, fontWeight: '700' }}
                >
                  Bezahlen & weiterspielen
                </AppText>
              </Pressable>
              <SharedTablePanel />
              {finishDayButton}
            </View>
          }
        />
      )}

      {activeTab !== 'history' ||
      roundSaved ||
      (undoTarget && undoTarget.tableId === currentTable?.id) ? (
        <View
          style={[
            styles.actionDock,
            { paddingBottom: Math.max(8, insets.bottom > 0 ? 4 : 12) },
          ]}
        >
          {activeTab !== 'history' ? <SyncStatus /> : null}
          {activeTab !== 'history' ? (
            <View
              style={styles.multiplierKpi}
              accessibilityLabel={`Gesamtmultiplikator: ${roundMultiplier}x`}
              accessibilityLiveRegion="polite"
            >
              <AppText style={styles.multiplierKpiLabel}>
                Gesamtfaktor · {placedCoinCount} Leger
                {turboRamschEnabled ? ' + Turbo' : ''}
              </AppText>
              <AppText style={styles.multiplierKpiValue}>
                {roundMultiplier}×
              </AppText>
            </View>
          ) : null}
          {undoTarget?.tableId === currentTable?.id && undoTarget ? (
            <RoundUndoNotice
              key={undoTarget.eventId}
              message={
                undoTarget.action === 'deleted'
                  ? 'Spiel gelöscht'
                  : undoTarget.action === 'updated'
                    ? 'Änderung gespeichert'
                    : 'Spiel eingetragen'
              }
              undoLabel={
                undoTarget.action === 'deleted'
                  ? 'Gelöschtes Spiel rückgängig machen'
                  : undoTarget.action === 'updated'
                    ? 'Spieländerung rückgängig machen'
                    : 'Spieleingabe rückgängig machen'
              }
              disabled={!canWrite}
              onDismiss={dismissUndo}
              onUndo={async () => {
                if (appliedUndo.current !== undoTarget.eventId) {
                  if (
                    !useGameStore
                      .getState()
                      .revertRoundChange(undoTarget.tableId, undoTarget.eventId)
                  )
                    return (
                      useGameStore.getState().roundError ??
                      'Die Änderung konnte nicht zurückgenommen werden.'
                    );
                  appliedUndo.current = undoTarget.eventId;
                }
                await reliableStorage.retryWrites();
                if (
                  !(await reliableStorage.confirmWrite(
                    'schafkopfrechner-games',
                  ))
                )
                  return 'Rücknahme noch nicht auf dem Gerät gespeichert. Bitte erneut versuchen; die Aktion wird nicht doppelt ausgeführt.';
                triggerSaveHaptic();
                return undefined;
              }}
            />
          ) : null}
          {roundSaved ? (
            <View accessibilityLiveRegion="polite" style={styles.savedNotice}>
              <AppText style={{ color: screenColors.gold }}>
                Auf Gerät gespeichert · Spielstände aktualisiert
              </AppText>
            </View>
          ) : null}
          {activeTab !== 'history' &&
          (currentTable?.settings.games.stock.enabled ||
            getStockBalanceCents(rounds) > 0) ? (
            <View
              accessible
              accessibilityLabel={`Stock: ${formatAmount(getStockBalanceCents(rounds) / 100)}`}
            >
              <AppText style={styles.multiplierKpiLabel}>
                Stock: {formatAmount(getStockBalanceCents(rounds) / 100)}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuRoot}>
          <Pressable
            accessibilityLabel="Menü schließen"
            accessibilityRole="button"
            style={styles.menuBackdrop}
            onPress={() => setMenuVisible(false)}
          />
          <View style={styles.menuCard}>
            <AppText style={styles.menuTitle}>Tisch verwalten</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tischstatistik öffnen"
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                if (currentTable)
                  navigation.navigate('TableStatistics', {
                    tableKey: `table:${currentTable.id}`,
                  });
              }}
            >
              <History color={screenColors.gold} size={20} />
              <AppText style={styles.menuText}>Tischstatistik</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Änderungsverlauf des Tisches"
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setHistoryVisible(true);
              }}
            >
              <History color={screenColors.gold} size={20} />
              <AppText style={styles.menuText}>Änderungsverlauf</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Spieleraktionen öffnen"
              disabled={!canManage}
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                if (currentTable)
                  setPlayerActions({
                    tableId: currentTable.id,
                    playerId: null,
                  });
              }}
            >
              <UsersRound color={screenColors.gold} size={20} />
              <AppText style={styles.menuText}>Spieleraktionen</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tisch bearbeiten"
              disabled={!canManage}
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                openTableSettings();
              }}
            >
              <SlidersHorizontal color={screenColors.gold} size={20} />
              <AppText style={styles.menuText}>Regeln & Tarife</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tisch archivieren"
              disabled={!canManage}
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                confirmArchiveTable();
              }}
            >
              <Trash2 color={screenColors.red} size={20} />
              <AppText style={styles.menuText}>Tisch archivieren</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Letzte Runde zurücknehmen"
              disabled={
                !canWrite ||
                !rounds.length ||
                rounds.at(-1)?.stockAction === 'carryIn'
              }
              style={styles.menuItem}
              onPress={() => {
                const state = useGameStore.getState();
                const last = state.rounds.at(-1);
                if (last) requestRoundDeletion(last, false);
              }}
            >
              <AppText style={styles.menuText}>
                Letzte Runde zurücknehmen
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.menuItem}
              onPress={() => setMenuVisible(false)}
            >
              <AppText style={styles.menuText}>Schließen</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {historyVisible && currentTable ? (
        <RoundHistoryModal
          table={currentTable}
          rounds={rounds}
          players={players}
          onClose={() => setHistoryVisible(false)}
          onRestore={canWrite ? restoreRound : undefined}
        />
      ) : null}
      {playerActions && playerActions.tableId === currentTable?.id ? (
        <PlayerActionsMenu
          key={`${playerActions.tableId}:${playerActions.playerId ?? 'all'}`}
          tableId={playerActions.tableId}
          players={players}
          dealerId={currentDealerId}
          initialPlayerId={playerActions.playerId}
          onClose={() => setPlayerActions(null)}
        />
      ) : null}
      {seatOrderVisible ? (
        <SeatOrderModal
          players={players}
          dealerId={currentDealerId}
          onClose={() => setSeatOrderVisible(false)}
          onSave={(ids) => {
            if (setPlayerOrder(ids)) setSeatOrderVisible(false);
            else
              appAlert(
                'Reihenfolge nicht gespeichert',
                'Die Spieler haben sich geändert. Bitte öffne die Reihenfolge erneut.',
              );
          }}
        />
      ) : null}
      <RoundEntrySheet
        initialDeclarerId={initialDeclarerId}
        key={`${currentTable?.id ?? 'none'}:${editingRoundId ?? 'new-round'}:${composerSession}`}
        table={currentTable}
        players={players}
        editingRound={editingRound}
        visible={roundComposerVisible}
        onClose={closeRoundComposer}
        onDismiss={() => {
          if (!roundComposerVisible) setEditingRoundId(null);
        }}
        onSaved={(eventId) => {
          triggerSaveHaptic();
          showUndo(eventId);
          setRoundSaved(!eventId);
          setRoundComposerVisible(false);
        }}
      />
      <Modal
        transparent
        visible={finishDialog !== null}
        animationType="fade"
        onRequestClose={() => setFinishDialog(null)}
      >
        <View style={styles.menuRoot}>
          <Pressable
            accessibilityLabel="Dialog schließen"
            accessibilityRole="button"
            style={styles.menuBackdrop}
            onPress={() => setFinishDialog(null)}
          />
          {finishDialog ? (
            <View
              style={[styles.menuCard, styles.deleteDialog]}
              accessibilityViewIsModal
            >
              <AppText
                accessibilityRole="header"
                style={[styles.menuTitle, styles.deleteTitle]}
              >
                {finishDialog.kind === 'archive'
                  ? 'Tisch archivieren'
                  : finishDialog.kind === 'stock'
                    ? 'Rest-Stock abschließen'
                    : finishDialog.title}
              </AppText>
              <AppText
                accessibilityRole={
                  finishDialog.kind === 'message' ? 'alert' : undefined
                }
                style={styles.menuText}
              >
                {finishDialog.kind === 'archive'
                  ? 'Der Spieltag wird abgeschlossen und die Abrechnung vorbereitet.'
                  : finishDialog.kind === 'stock'
                    ? `${formatAmount(finishDialog.potCents / 100)} liegen im Stock. Verteilen teilt den Stock unter den aktuell aktiven Spielern auf, einschließlich des regulär aussetzenden Gebers. Pausierte Spieler erhalten keinen Anteil. Übernehmen eröffnet einen Folgetisch mit demselben Stock.`
                    : finishDialog.message}
              </AppText>
              {finishDialog.kind === 'archive' ? (
                <GoldButton
                  title="Archivieren"
                  accessibilityLabel="Archivieren bestätigen"
                  onPress={finishDay}
                />
              ) : null}
              {finishDialog.kind === 'stock' ? (
                <>
                  <GoldButton
                    title="Stock verteilen"
                    accessibilityLabel="Stock verteilen"
                    onPress={() => completeFinish('refund')}
                  />
                  <GoldButton
                    title="Stock übernehmen"
                    accessibilityLabel="Stock übernehmen"
                    onPress={() => completeFinish('carry')}
                  />
                </>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  finishDialog.kind === 'message'
                    ? 'Hinweis schließen'
                    : 'Abschluss abbrechen'
                }
                onPress={() => setFinishDialog(null)}
                style={({ pressed }) => [
                  styles.deleteCancel,
                  pressed && styles.pressed,
                ]}
              >
                <AppText style={styles.deleteCancelText}>
                  {finishDialog.kind === 'message' ? 'OK' : 'Abbrechen'}
                </AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
      <Modal
        transparent
        visible={undoConfirmVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!deletionSaving) setUndoConfirmVisible(false);
        }}
      >
        <View style={styles.menuRoot}>
          <View
            style={[styles.menuCard, styles.deleteDialog]}
            accessibilityViewIsModal
          >
            <AppText
              accessibilityRole="header"
              style={[styles.menuTitle, styles.deleteTitle]}
            >
              {deleteCandidate?.fromHistory
                ? 'Spiel l\u00f6schen?'
                : 'Letzte Runde zur\u00fccknehmen?'}
            </AppText>
            {deletionError ? (
              <AppText accessibilityRole="alert" style={styles.menuText}>
                {deletionError}
              </AppText>
            ) : null}
            <GoldButton
              title={
                deletionError
                  ? 'Erneut versuchen'
                  : deleteCandidate?.fromHistory
                    ? 'Spiel l\u00f6schen'
                    : 'Runde zur\u00fccknehmen'
              }
              accessibilityLabel="Runde zurücknehmen bestätigen"
              disabled={deletionSaving}
              loading={deletionSaving}
              onPress={async () => {
                if (deletionLock.current) return;
                deletionLock.current = true;
                setDeletionSaving(true);
                setDeletionError('');
                try {
                  const before = useGameStore.getState();
                  const candidate = deleteCandidate;
                  if (
                    !candidate ||
                    before.currentTable?.id !== candidate.tableId
                  )
                    throw new Error(
                      'Der Tisch wurde inzwischen gewechselt. Bitte die Rücknahme erneut öffnen.',
                    );
                  if (!pendingDeletion.current) {
                    if (
                      !before.undoLastRound(
                        candidate.roundId,
                        candidate.eventId,
                        candidate.fingerprint,
                        candidate.fromHistory,
                      )
                    )
                      throw new Error(
                        useGameStore.getState().roundError ??
                          'Die Runde konnte nicht zurückgenommen werden.',
                      );
                    pendingDeletion.current = useGameStore
                      .getState()
                      .currentTable?.roundHistory?.slice()
                      .reverse()
                      .find(
                        (event) =>
                          event.roundId === candidate.roundId &&
                          event.action === 'deleted',
                      )?.id;
                  }
                  await reliableStorage.retryWrites();
                  if (
                    !(await reliableStorage.confirmWrite(
                      'schafkopfrechner-games',
                    ))
                  )
                    throw new Error(
                      'Die Löschung ist noch nicht auf dem Gerät gesichert. Bitte erneut sichern; es wird kein weiteres Spiel gelöscht.',
                    );
                  if (
                    useGameStore.getState().currentTable?.id ===
                    candidate.tableId
                  )
                    showUndo(pendingDeletion.current);
                  pendingDeletion.current = undefined;
                  setUndoConfirmVisible(false);
                  setRoundSaved(false);
                } catch (error) {
                  setDeletionError(
                    error instanceof Error
                      ? error.message
                      : 'Speichern fehlgeschlagen.',
                  );
                } finally {
                  deletionLock.current = false;
                  setDeletionSaving(false);
                }
              }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={deletionSaving}
              accessibilityLabel="Zurücknehmen abbrechen"
              onPress={() => setUndoConfirmVisible(false)}
              style={({ pressed }) => [
                styles.deleteCancel,
                pressed && styles.pressed,
                deletionSaving && { opacity: 0.5 },
              ]}
            >
              <AppText style={styles.deleteCancelText}>Abbrechen</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AuthBackground>
  );
}

function SeatOrderModal({
  players,
  dealerId,
  onClose,
  onSave,
}: {
  players: Player[];
  dealerId: string | null;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [order, setOrder] = useState(() => players.map((player) => player.id));
  const move = (index: number, offset: number) => {
    setOrder((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.menuRoot}>
        <Pressable
          accessibilityLabel="Reihenfolge abbrechen"
          accessibilityRole="button"
          style={styles.menuBackdrop}
          onPress={onClose}
        />
        <View style={[styles.menuCard, styles.orderCard]}>
          <AppText style={styles.menuTitle}>Sitzreihenfolge</AppText>
          <AppText style={styles.orderHelp}>
            Ordne die Spieler wie am Tisch im Uhrzeigersinn. Der aktuelle Geber
            bleibt erhalten; danach wird in dieser Reihenfolge weitergegeben.
          </AppText>
          <ScrollView style={styles.orderScroller}>
            {order.map((id, index) => {
              const player = players.find((candidate) => candidate.id === id);
              if (!player) return null;
              return (
                <View key={id} style={styles.orderRow}>
                  <AppText style={styles.orderNumber}>{index + 1}</AppText>
                  <View style={styles.playerCopy}>
                    <Text
                      style={[
                        styles.playerName,
                        player.isPaused && { opacity: 0.5 },
                      ]}
                    >
                      {player.name}
                    </Text>
                    {player.isPaused ? (
                      <AppText style={styles.dealerLabel}>Pausiert</AppText>
                    ) : null}
                    {id === dealerId ? (
                      <AppText style={styles.dealerLabel}>Geber</AppText>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityLabel={`${player.name} nach oben`}
                    accessibilityRole="button"
                    disabled={index === 0}
                    accessibilityState={{ disabled: index === 0 }}
                    style={[
                      styles.orderIcon,
                      index === 0 && styles.orderDisabled,
                    ]}
                    onPress={() => move(index, -1)}
                  >
                    <ArrowUp size={20} color={screenColors.gold} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`${player.name} nach unten`}
                    accessibilityRole="button"
                    disabled={index === order.length - 1}
                    accessibilityState={{
                      disabled: index === order.length - 1,
                    }}
                    style={[
                      styles.orderIcon,
                      index === order.length - 1 && styles.orderDisabled,
                    ]}
                    onPress={() => move(index, 1)}
                  >
                    <ArrowDown size={20} color={screenColors.gold} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
          <GoldButton
            title="Reihenfolge speichern"
            accessibilityLabel="Reihenfolge speichern"
            onPress={() => onSave(order)}
          />
          <Pressable
            style={styles.menuItem}
            accessibilityRole="button"
            accessibilityLabel="Reihenfolge abbrechen"
            onPress={onClose}
          >
            <AppText style={styles.menuText}>Abbrechen</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createRankedPlayers(
  players: Player[],
  balances: PlayerBalance[],
  placedCoinsByPlayerId: Record<string, number>,
): RankedPlayer[] {
  const amountByPlayer = new Map(
    balances.map((balance) => [balance.playerId, balance.amount]),
  );

  return players
    .map((player, index) => {
      const visual = getPlayerVisual(index);

      return {
        ...visual,
        amount: amountByPlayer.get(player.id) ?? 0,
        id: player.id,
        isPaused: player.isPaused,
        isLeader: false,
        name: player.name,
        placedCoins: normalizeCoinCount(placedCoinsByPlayerId[player.id]),
        rank: 0,
        seatIndex: index,
      };
    })
    .map((player, index) => ({
      ...player,
      isLeader: index === 0 && player.amount > 0,
      rank: index + 1,
    }));
}

type SegmentedTabsProps = {
  activeTab: ActiveTab;
  onShowHistory: () => void;
  onShowPlayers: () => void;
};

const SegmentedTabs = memo(function SegmentedTabs({
  activeTab,
  onShowHistory,
  onShowPlayers,
}: SegmentedTabsProps) {
  const [width, setWidth] = useState(0);
  const position = useSharedValue(activeTab === 'history' ? 1 : 0);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * (width / 2) }],
  }));

  useEffect(() => {
    position.value = withTiming(activeTab === 'history' ? 1 : 0, {
      duration: 220,
    });
  }, [activeTab, position]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View style={styles.segmented} onLayout={handleLayout}>
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentIndicator,
            { width: width / 2 - 6 },
            indicatorStyle,
          ]}
        />
      ) : null}
      <SegmentButton
        icon={UsersRound}
        label="Spieler"
        selected={activeTab === 'players'}
        onPress={onShowPlayers}
      />
      <SegmentButton
        icon={History}
        label="Verlauf"
        selected={activeTab === 'history'}
        onPress={onShowHistory}
      />
    </View>
  );
});

type SegmentButtonProps = {
  icon: typeof UsersRound;
  label: string;
  selected: boolean;
  onPress: () => void;
};

const SegmentButton = memo(function SegmentButton({
  icon: Icon,
  label,
  selected,
  onPress,
}: SegmentButtonProps) {
  return (
    <Pressable
      accessibilityHint={`Wechselt zum Tab ${label}`}
      accessibilityLabel={`${label} Tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      hitSlop={touchHitSlop}
      onPress={onPress}
      style={({ pressed }) => [styles.segmentButton, pressed && styles.pressed]}
    >
      <Icon
        color={selected ? '#17150B' : screenColors.gold}
        size={16}
        strokeWidth={2.5}
      />
      <AppText
        style={[styles.segmentText, selected && styles.segmentTextActive]}
      >
        {label}
      </AppText>
    </Pressable>
  );
});

type PlayerRankingRowProps = {
  dragging: boolean;
  canReorder?: boolean;
  onDrag: () => void;
  participating: boolean;
  onOpenActions: () => void;
  isDealer: boolean;
  hasMisdeal: boolean;
  player: RankedPlayer;
  profileCard?: ProfileCard;
  onPressCoin: (playerId: string) => void;
  onPressPlayer: (player: RankedPlayer) => void;
};

const PlayerRankingRow = memo(function PlayerRankingRow({
  dragging,
  canReorder = true,
  onDrag,
  participating,
  onOpenActions,
  isDealer,
  hasMisdeal,
  onPressCoin,
  player,
  profileCard,
  onPressPlayer,
}: PlayerRankingRowProps) {
  const name = profileCard?.displayName ?? player.name;
  const isPositive = player.amount > 0;
  const isNegative = player.amount < 0;
  const [hovered, setHovered] = useState(false);
  const longPressed = useRef(false);
  const handlePress = useCallback(() => {
    if (dragging) return;
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (participating) onPressPlayer(player);
  }, [onPressPlayer, player, participating, dragging]);
  const handlePressCoin = useCallback(() => {
    onPressCoin(player.id);
  }, [onPressCoin, player.id]);

  return (
    <View style={[styles.playerRow, hovered && styles.rowHovered]}>
      <Pressable
        accessibilityLabel={`${name}, ${formatAmount(player.amount)}${isDealer ? ', Geber' : ''}${hasMisdeal ? ', Einmal vergeben' : ''}${player.isPaused ? ', Pausiert' : !participating ? ', setzt aus' : ''}`}
        accessibilityRole="button"
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={handlePress}
        disabled={dragging}
        onPressIn={() => {
          longPressed.current = false;
        }}
        onLongPress={() => {
          if (dragging) return;
          longPressed.current = true;
          onOpenActions();
        }}
        accessibilityHint="Antippen, um ein Spiel mit diesem Ansager zu erfassen. Gedrückt halten, um Spieleraktionen zu öffnen."
        style={({ pressed }) => [
          styles.playerIdentity,
          pressed && styles.rowPressed,
        ]}
      >
        {profileCard ? (
          <ProfileAvatar profile={profileCard} size={32} />
        ) : (
          <CardStackIcon isDealer={isDealer} />
        )}
        <View style={styles.playerCopy}>
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[styles.playerName, player.isPaused && { opacity: 0.5 }]}
          >
            {name}
            {hasMisdeal ? (
              <Text style={styles.amountNegative}>{'  \u2715'}</Text>
            ) : null}
          </Text>
          {player.isPaused ? (
            <AppText style={styles.dealerLabel}>Pausiert</AppText>
          ) : !participating ? (
            <AppText style={styles.dealerLabel}>Setzt aus</AppText>
          ) : null}
          {isDealer ? (
            <AppText style={styles.dealerLabel}>Geber</AppText>
          ) : null}
        </View>
      </Pressable>
      <Text
        style={[
          styles.playerAmount,
          isPositive && styles.amountPositive,
          isNegative && styles.amountNegative,
          !isPositive && !isNegative && styles.amountNeutral,
        ]}
      >
        {isPositive ? '+' : ''}
        {formatAmount(player.amount)}
      </Text>
      {participating ? (
        <CoinMultiplierBadge
          disabled={dragging}
          coinCount={player.placedCoins}
          playerName={name}
          onPress={handlePressCoin}
        />
      ) : (
        <View style={styles.coinColumn} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} verschieben`}
        accessibilityHint="Griff gedrückt halten und ziehen, um die Sitzreihenfolge zu ändern. Loslassen beendet das Verschieben. Alternativ das Listensymbol verwenden."
        accessibilityState={{ selected: dragging }}
        disabled={!canReorder}
        delayLongPress={300}
        onLongPress={onDrag}
        style={styles.dragHandle}
      >
        <Menu
          size={20}
          color={dragging ? screenColors.gold : screenColors.soft}
        />
      </Pressable>
    </View>
  );
});

const CardStackIcon = memo(function CardStackIcon({
  isDealer,
}: {
  isDealer: boolean;
}) {
  return (
    <Svg
      {...(Platform.OS === 'web'
        ? { 'aria-hidden': true }
        : {
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants' as const,
          })}
      width={38}
      height={46}
      viewBox="0 0 38 46"
    >
      <Rect
        x="3"
        y="6"
        width="23"
        height="33"
        rx="4"
        fill="#254235"
        stroke="#77937B"
        strokeWidth="1"
        transform="rotate(-12 15 23)"
      />
      <Rect
        x="12"
        y="5"
        width="23"
        height="34"
        rx="4"
        fill={isDealer ? '#EAE3CB' : '#254235'}
        stroke={isDealer ? '#C5AB62' : '#77937B'}
        strokeWidth="1"
        transform="rotate(7 24 22)"
      />
      {isDealer ? (
        <G testID="dealer-acorn">
          <Path
            d="M24 15 Q24 11 27 11"
            stroke="#6D5528"
            strokeWidth="1.5"
            fill="none"
          />
          <Path
            d="M18 23 Q17 32 23 33 Q29 31 29 23 Z"
            fill="#B29A55"
            stroke="#6D5528"
            strokeWidth="1"
          />
          <Path
            d="M17 23 Q17 16 23 16 Q30 16 30 23 Z"
            fill="#8B793F"
            stroke="#6D5528"
            strokeWidth="1"
          />
          <Ellipse cx="23" cy="23" rx="6.5" ry="1.5" fill="#C1AB6B" />
        </G>
      ) : (
        <G testID="covered-cards">
          <Rect
            x="16"
            y="9"
            width="15"
            height="26"
            rx="2"
            fill="none"
            stroke="#607F68"
            strokeWidth="0.7"
            transform="rotate(7 24 22)"
          />
          <Path
            d="M24 15 L28 22 L24 29 L20 22 Z"
            fill="none"
            stroke="#7D967B"
            strokeWidth="0.8"
          />
        </G>
      )}
    </Svg>
  );
});

type CoinMultiplierBadgeProps = {
  disabled?: boolean;
  coinCount: number;
  playerName: string;
  onPress?: () => void;
};

function normalizeCoinCount(coinCount: number, maxCoins = 1) {
  if (!Number.isFinite(coinCount)) {
    return 0;
  }

  return Math.max(0, Math.min(maxCoins, Math.round(coinCount)));
}

function getMultiplierLabel(coinCount: number) {
  const safeCoinCount = normalizeCoinCount(coinCount);

  return `${2 ** safeCoinCount}x`;
}

const CoinMultiplierBadge = memo(function CoinMultiplierBadge({
  disabled = false,
  coinCount,
  playerName,
  onPress,
}: CoinMultiplierBadgeProps) {
  const count = normalizeCoinCount(coinCount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Leger ${playerName}: ${getMultiplierLabel(count)}`}
      disabled={disabled}
      accessibilityState={{ selected: count > 0, disabled }}
      accessibilityHint={
        count > 0
          ? 'Nimmt den Leger dieses Spielers zurück'
          : 'Legt einmal und verdoppelt den gemeinsamen Faktor'
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.coinBadgeTapTarget,
        pressed && styles.coinBadgePressed,
      ]}
    >
      <EuroStyleCoin label={`${2 ** count}×`} muted={count === 0} />
    </Pressable>
  );
});

type HistoryRoundRowProps = {
  stockPayoutCents: number;
  roundNumber: number;
  round: GameRound;
  getPlayerName: (playerId: string) => string;
};

const HistoryRoundRow = memo(function HistoryRoundRow({
  stockPayoutCents,
  round,
  getPlayerName,
  roundNumber,
}: HistoryRoundRowProps) {
  const losers = useMemo(
    () => round.loserIds.map(getPlayerName).join(', '),
    [getPlayerName, round.loserIds],
  );
  const time = useMemo(
    () =>
      new Date(round.createdAt).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [round.createdAt],
  );
  const winner = useMemo(
    () => roundWinnerIds(round).map(getPlayerName).join(' & '),
    [getPlayerName, round],
  );

  return (
    <MatchHistoryCard
      compact
      roundNumber={roundNumber}
      displayGameType={formatRoundGameType(round.gameType, round.suit)}
      misdealPlayer={
        round.misdealPlayerId ? getPlayerName(round.misdealPlayerId) : undefined
      }
      customAmounts={
        isCustomBooking(round)
          ? round.customAmounts!.map((entry) => ({
              name: getPlayerName(entry.playerId),
              amount: entry.amount,
            }))
          : undefined
      }
      stockMovement={
        round.stockRulesVersion === 1 &&
        (round.stockAction === 'double' || round.stockAction === 'payout')
          ? `Stock ${round.stockAction === 'double' ? 'verdoppelt' : 'ausgezahlt'}: ${formatAmount((round.stockBeforeCents ?? 0) / 100)} → ${formatAmount((round.stockAfterCents ?? 0) / 100)}`
          : undefined
      }
      details={
        isStockBooking(round) || isCustomBooking(round)
          ? undefined
          : round.declarerId
            ? `Ansager: ${getPlayerName(round.declarerId)}${round.partnerId ? ` · Partner: ${getPlayerName(round.partnerId)}` : ''}`
            : 'Ansager: unbekannt'
      }
      stockBooking={
        round.stockAction === 'carryIn'
          ? 'Stock übernommen'
          : round.stockAction === 'carryOut'
            ? 'Stock übertragen'
            : round.stockAction === 'refund'
              ? 'Stock zurückgegeben'
              : undefined
      }
      stockDeposit={round.stockAction === 'deposit'}
      amount={formatAmount(round.amount + stockPayoutCents / 100)}
      gameType={`${formatRoundGameType(round.gameType, round.suit)}${round.stockAction === 'payout' ? ` + Stock ${formatAmount(stockPayoutCents / 100)}` : ''}`}
      losers={losers}
      time={time}
      winner={winner}
    />
  );
});

const styles = StyleSheet.create({
  dragHandle: {
    width: 44,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  turboCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,245,245,0.1)',
    backgroundColor: '#142A20',
  },
  turboCardActive: { borderColor: 'rgba(231,198,92,0.4)' },
  turboCopy: { flex: 1, minWidth: 0 },
  turboTitle: { color: screenColors.text, fontSize: 16, fontWeight: '700' },
  turboHint: {
    color: screenColors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  dragTableEnd: {
    height: 20,
    backgroundColor: '#10251C',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(245,245,245,0.1)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  dragTableHeader: {
    backgroundColor: 'rgba(20,42,32,0.42)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(245,245,245,0.1)',
  },
  dragTableRow: {
    backgroundColor: '#10251C',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(245,245,245,0.1)',
  },
  dragHint: {
    color: screenColors.soft,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },

  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderIcon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCard: { maxHeight: '85%' },
  orderHelp: {
    color: screenColors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  orderScroller: { flexShrink: 1, marginBottom: 16 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: screenColors.border,
  },
  orderNumber: { color: screenColors.soft, fontSize: 12, width: 16 },
  orderDisabled: { opacity: 0.25 },

  multiplierKpi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(231,198,92,0.07)',
  },
  multiplierKpiLabel: {
    color: screenColors.muted,
    fontSize: 12,
    flexShrink: 1,
  },
  multiplierKpiValue: {
    color: screenColors.gold,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: screenColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#82B37C',
  },
  statusText: { color: screenColors.muted, fontSize: 12 },
  playerCount: { color: screenColors.muted, fontSize: 12, marginLeft: 'auto' },
  playerTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  columnLabel: {
    color: screenColors.soft,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  nameColumn: { flex: 1, minWidth: 0 },
  balanceColumn: { width: 82, textAlign: 'right' },
  coinColumn: { width: 52, textAlign: 'center' },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    minHeight: 52,
  },
  dealerLabel: {
    color: screenColors.gold,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: screenColors.border,
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  balancedHint: {
    color: screenColors.soft,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  actionDock: {
    backgroundColor: '#0B1D16',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,245,245,0.07)',
  },
  menuRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  menuCard: {
    backgroundColor: '#142A20',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: screenColors.border,
  },
  menuTitle: {
    color: screenColors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  deleteDialog: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    gap: 12,
  },
  deleteTitle: {
    marginBottom: 4,
    textAlign: 'center',
  },
  deleteCancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCancelText: {
    color: screenColors.muted,
    fontWeight: '600',
  },
  menuItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: { color: screenColors.text, fontSize: 16 },

  savedNotice: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: screenColors.cardStrong,
  },
  content: {
    paddingBottom: 132,
    paddingHorizontal: 20,
    paddingTop: authSpacing.sm,
  },
  scroller: {
    flex: 1,
  },
  center: {
    flex: 1,
    gap: authSpacing.xl,
    justifyContent: 'center',
    padding: authSpacing.xl,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navPill: { alignItems: 'center', flexDirection: 'row', minHeight: 44 },
  backPill: {
    gap: authSpacing.sm,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: screenColors.border,
    backgroundColor: screenColors.card,
  },
  navPillText: { color: screenColors.gold, fontSize: 16, fontWeight: '600' },
  tableHeader: { marginBottom: 16 },
  tableTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  compactStats: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(245,245,245,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(245,245,245,0.09)',
    borderRadius: 18,
  },
  statChip: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    minHeight: 44,
  },
  statChipLabel: {
    color: screenColors.soft,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statChipValue: {
    textAlign: 'center',
    color: screenColors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  title: {
    color: screenColors.text,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '700',
  },
  segmented: {
    backgroundColor: 'rgba(245, 245, 245, 0.055)',
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    overflow: 'hidden',
    padding: 3,
    position: 'relative',
    shadowColor: screenColors.shadow,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  segmentIndicator: {
    backgroundColor: screenColors.gold,
    borderRadius: authRadius.pill,
    bottom: 3,
    left: 3,
    position: 'absolute',
    shadowColor: screenColors.gold,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    top: 3,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: authSpacing.xs,
    justifyContent: 'center',
    minHeight: 42,
    zIndex: 1,
  },
  segmentText: {
    color: screenColors.gold,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: '#17150B',
  },
  stack: { marginTop: 16 },
  historyHeaderStack: {
    marginBottom: 0,
  },
  historyColumns: {
    flexDirection: 'row',
    gap: authSpacing.sm,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: screenColors.gold,
  },
  historySeparator: {
    height: 0,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: authSpacing.sm,
  },
  sectionTitle: {
    color: screenColors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: screenColors.soft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 72,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,245,245,0.1)',
  },
  rowPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.988 }],
  },
  rowHovered: {
    backgroundColor: 'rgba(42, 73, 55, 0.54)',
  },
  coinBadgeTapTarget: {
    width: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
  coinBadgePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
  playerCopy: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: screenColors.text,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  playerAmount: {
    color: screenColors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    width: 82,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  amountPositive: {
    color: screenColors.gold,
  },
  amountNegative: {
    color: screenColors.red,
  },
  amountNeutral: {
    color: screenColors.muted,
  },
  finishButton: {
    marginTop: 20,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});
