import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Ellipsis,
  History,
  ListOrdered,
  Plus,
  ReceiptText,
  SlidersHorizontal,
  Trash2,
  UsersRound,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { MatchHistoryCard } from '../../components/game/MatchHistoryCard';
import { RoundEntrySheet } from '../../components/game/RoundEntrySheet';
import { SyncStatus } from '../../components/game/SyncStatus';
import { AppText } from '../../components/ui/AppText';
import { PROFILE_ACCENTS } from '../../constants/profileCustomization';
import type { AppStackScreenProps } from '../../navigation/types';
import { useGameStore } from '../../store/gameStore';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { GameRound, Player, PlayerBalance } from '../../types/game';
import type { AnimalAvatarId } from '../../types/profile';
import {
  getStockBalanceCents,
  isStockBooking,
  roundWinnerIds,
} from '../../utils/accounting';
import { formatRoundGameType } from '../../utils/cardSuits';
import { getCurrentDealerId, getNextDealerId } from '../../utils/dealerOrder';

type ActiveGameScreenProps = AppStackScreenProps<'ActiveGame'>;
type ActiveTab = 'players' | 'history';

type RankedPlayer = {
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
  const [seatOrderVisible, setSeatOrderVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('players');
  const [roundComposerVisible, setRoundComposerVisible] = useState(false);
  const [composerSession, setComposerSession] = useState(0);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [undoConfirmVisible, setUndoConfirmVisible] = useState(false);
  const editingRound =
    rounds.find((round) => round.id === editingRoundId) ?? null;
  const placedCoinsByPlayerId = useMemo<Record<string, number>>(
    () =>
      Object.fromEntries(
        (currentTable?.placedLegerPlayerIds ?? []).map((id) => [id, 1]),
      ),
    [currentTable?.placedLegerPlayerIds],
  );

  const rankedPlayers = useMemo(
    () => createRankedPlayers(players, balances, placedCoinsByPlayerId),
    [balances, placedCoinsByPlayerId, players],
  );
  const currentDealerId = getCurrentDealerId(
    currentTable,
    players,
    rounds.length,
  );
  const nextDealerId = getNextDealerId(currentTable, players, rounds.length);
  const dealerName =
    players.find(({ id }) => id === currentDealerId)?.name ?? '–';
  const nextDealerName =
    players.find(({ id }) => id === nextDealerId)?.name ?? '–';
  const recentRounds = useMemo(() => [...rounds].reverse(), [rounds]);
  const playedRounds = rounds.filter((round) => !isStockBooking(round)).length;
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
    setComposerSession((value) => value + 1);
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
          ['deposit', 'payout'].includes(round.stockAction))
      )
        editRound(round);
      navigation.setParams({ roundId: undefined });
    }, 0);
    return () => clearTimeout(timer);
  }, [route?.params?.roundId, rounds, editRound, navigation]);
  const renderHistoryRound: ListRenderItem<GameRound> = useCallback(
    ({ item }) => (
      <HistoryRoundRow
        round={item}
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
        onEdit={editRound}
      />
    ),
    [getPlayerName, editRound, rounds],
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

  const openRoundComposer = useCallback(() => {
    setComposerSession((value) => value + 1);
    triggerSelectionHaptic();
    setRoundSaved(false);
    setEditingRoundId(null);
    setRoundComposerVisible(true);
  }, []);

  const closeRoundComposer = useCallback(() => {
    triggerSelectionHaptic();
    setRoundComposerVisible(false);
  }, []);

  const showPlayerDetails = useCallback((player: RankedPlayer) => {
    triggerSelectionHaptic();
    Alert.alert(
      player.name,
      `Aktueller Kontostand: ${formatAmount(player.amount)}`,
    );
  }, []);

  const finishDay = useCallback(() => {
    triggerSelectionHaptic();
    const complete = (resolution?: 'refund' | 'carry') => {
      const finishedTableId = useGameStore.getState().currentTable?.id;
      if (!finishGameDay(resolution)) {
        Alert.alert(
          'Abschluss nicht möglich',
          'Bitte prüfe den aktiven Tisch und seine Rundeneinträge. Ungültige Abrechnungsdaten werden nicht abgeschlossen.',
        );
        return;
      }
      if (finishedTableId) {
        navigation.navigate('Settlement', { tableId: finishedTableId });
      }
    };
    const pot = getStockBalanceCents(useGameStore.getState().rounds);
    if (pot > 0) {
      Alert.alert(
        'Rest-Stock abschließen',
        `${formatAmount(pot / 100)} liegen im Stock. Zurückgeben erstattet jedem Einzahler seinen Anteil. Übernehmen eröffnet einen Folgetisch mit denselben vier Spielern und demselben Stock.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Stock zurückgeben', onPress: () => complete('refund') },
          { text: 'Stock übernehmen', onPress: () => complete('carry') },
        ],
      );
    } else complete();
  }, [finishGameDay, navigation]);

  const confirmArchiveTable = useCallback(() => {
    triggerSelectionHaptic();
    Alert.alert(
      'Tisch archivieren',
      'Der Spieltag wird abgeschlossen und die Abrechnung vorbereitet.',
      [
        { style: 'cancel', text: 'Abbrechen' },
        {
          onPress: finishDay,
          style: 'destructive',
          text: 'Archivieren',
        },
      ],
    );
  }, [finishDay]);

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
      Alert.alert(
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
          <ArrowLeft color={screenColors.text} size={24} strokeWidth={2.7} />
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
            <AppText style={styles.statusText}>Runde läuft</AppText>
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
          <Text style={styles.statChipValue}>{dealerName}</Text>
        </View>
        <View style={styles.statChip}>
          <AppText style={styles.statChipLabel}>Danach</AppText>
          <Text style={styles.statChipValue}>{nextDealerName}</Text>
        </View>
      </View>

      <SegmentedTabs
        activeTab={activeTab}
        onShowHistory={showHistoryTab}
        onShowPlayers={showPlayersTab}
      />
    </>
  );

  const finishDayButton = (
    <Pressable
      accessibilityHint="Schliesst den Spieltag ab und zeigt die Abrechnung"
      accessibilityLabel="Spieltag abschliessen"
      accessibilityRole="button"
      hitSlop={touchHitSlop}
      onPress={finishDay}
      style={({ pressed }) => [
        styles.finishButton,
        pressed && styles.finishPressed,
      ]}
    >
      <AppText style={styles.finishText}>Spieltag abschließen</AppText>
      <ChevronRight color={screenColors.gold} size={18} strokeWidth={2.4} />
    </Pressable>
  );

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

      {roundSaved ? (
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={[styles.savedNotice, { bottom: 190 }]}
        >
          <AppText style={{ color: screenColors.gold }}>
            Auf Gerät gespeichert · Spielstände aktualisiert
          </AppText>
        </View>
      ) : null}
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
              message="Tippe auf Spiel eintragen, um das erste Spiel zu erfassen."
            />
          }
          ListHeaderComponent={
            <>
              {tableOverviewHeader}
              <Animated.View style={[styles.stack, styles.historyHeaderStack]}>
                <View style={styles.sectionHeader}>
                  <View>
                    <AppText style={styles.sectionTitle}>Spielverlauf</AppText>
                    <AppText style={styles.sectionSubtitle}>
                      Spiel antippen, um es zu bearbeiten
                    </AppText>
                  </View>
                  <View style={styles.roundCountPill}>
                    <AppText style={styles.roundCountText}>
                      {playedRounds} Spiele
                      {rounds.length > playedRounds
                        ? ` · ${rounds.length - playedRounds} Buchungen`
                        : ''}
                    </AppText>
                  </View>
                </View>
                <View style={styles.historyColumns}>
                  <AppText style={[styles.columnLabel, { flex: 1.1 }]}>
                    Spiel
                  </AppText>
                  <AppText style={[styles.columnLabel, { flex: 1 }]}>
                    Gewinner
                  </AppText>
                  <AppText
                    style={[
                      styles.columnLabel,
                      { width: 78, textAlign: 'right' },
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
        <FlatList
          testID="player-standings-list"
          data={rankedPlayers}
          keyExtractor={(player) => player.id}
          style={styles.scroller}
          contentContainerStyle={[styles.content, { paddingBottom: 16 }]}
          contentOffset={{ x: 0, y: scrollOffsets.players }}
          onScroll={(event) => {
            scrollPositions.current.players = event.nativeEvent.contentOffset.y;
          }}
          scrollEnabled
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {tableOverviewHeader}
              <View style={[styles.stack, styles.dragTableHeader]}>
                <View style={styles.playerTableHeader}>
                  <View style={[styles.nameColumn, styles.orderHeader]}>
                    <AppText style={styles.columnLabel}>Spieler</AppText>
                    <Pressable
                      accessibilityLabel="Sitzreihenfolge ändern"
                      accessibilityRole="button"
                      onPress={() => setSeatOrderVisible(true)}
                      style={styles.orderIcon}
                    >
                      <ListOrdered size={18} color={screenColors.gold} />
                    </Pressable>
                  </View>
                  <AppText style={[styles.columnLabel, styles.balanceColumn]}>
                    Saldo
                  </AppText>
                  <AppText style={[styles.columnLabel, styles.coinColumn]}>
                    Leger
                  </AppText>
                </View>
              </View>
            </>
          }
          renderItem={({ item: player }) => (
            <View style={styles.dragTableRow}>
              <PlayerRankingRow
                isDealer={player.id === currentDealerId}
                player={player}
                onPressPlayer={showPlayerDetails}
                onPressCoin={togglePlacedCoin}
                onReorder={() => setSeatOrderVisible(true)}
              />
            </View>
          )}
          ListFooterComponent={
            <View>
              <View style={styles.dragTableEnd} />
              <AppText style={styles.dragHint}>
                Sitzreihenfolge über das Listensymbol oder langes Drücken ändern
              </AppText>
              {balances.every((balance) => balance.amount === 0) ? (
                <AppText style={styles.balancedHint}>
                  Alle Spielstände ausgeglichen
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
                  accessibilityHint="Verdoppelt den Spielwert zusätzlich zu den Legern"
                  value={turboRamschEnabled}
                  onValueChange={setTurboRamsch}
                  thumbColor="#F5F5F5"
                  ios_backgroundColor="#3B4C42"
                  trackColor={{ false: '#3B4C42', true: '#6FA972' }}
                />
              </View>
            </View>
          }
        />
      )}

      <View
        style={[
          styles.actionDock,
          { paddingBottom: Math.max(8, insets.bottom > 0 ? 4 : 12) },
        ]}
      >
        <SyncStatus />
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
        {currentTable?.settings.games.stock.enabled ||
        getStockBalanceCents(rounds) > 0 ? (
          <View
            accessible
            accessibilityLabel={`Stock: ${formatAmount(getStockBalanceCents(rounds) / 100)}`}
          >
            <AppText style={styles.multiplierKpiLabel}>
              Stock: {formatAmount(getStockBalanceCents(rounds) / 100)}
            </AppText>
          </View>
        ) : null}
        <Pressable
          accessibilityLabel="Spiel eintragen"
          accessibilityRole="button"
          onPress={openRoundComposer}
          style={({ pressed }) => [
            styles.addGameButton,
            pressed && styles.pressed,
          ]}
        >
          <Plus color="#15241B" size={24} />
          <AppText style={styles.addGameText}>Spiel eintragen</AppText>
        </Pressable>
        {finishDayButton}
      </View>
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
              accessibilityLabel="Tisch bearbeiten"
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
                !rounds.length || rounds.at(-1)?.stockAction === 'carryIn'
              }
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setUndoConfirmVisible(true);
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

      {seatOrderVisible ? (
        <SeatOrderModal
          players={players}
          dealerId={currentDealerId}
          onClose={() => setSeatOrderVisible(false)}
          onSave={(ids) => {
            if (setPlayerOrder(ids)) setSeatOrderVisible(false);
            else
              Alert.alert(
                'Reihenfolge nicht gespeichert',
                'Die Spieler haben sich geändert. Bitte öffne die Reihenfolge erneut.',
              );
          }}
        />
      ) : null}
      <RoundEntrySheet
        key={`${currentTable?.id ?? 'none'}:${editingRoundId ?? 'new-round'}:${composerSession}`}
        table={currentTable}
        players={players}
        editingRound={editingRound}
        visible={roundComposerVisible}
        onClose={closeRoundComposer}
        onDismiss={() => {
          if (!roundComposerVisible) setEditingRoundId(null);
        }}
        onSaved={() => {
          triggerSaveHaptic();
          setRoundSaved(true);
          setRoundComposerVisible(false);
        }}
      />
      <Modal
        transparent
        visible={undoConfirmVisible}
        animationType="fade"
        onRequestClose={() => setUndoConfirmVisible(false)}
      >
        <View style={styles.menuRoot}>
          <View style={styles.menuCard}>
            <AppText style={styles.menuTitle}>
              Letzte Runde zurücknehmen?
            </AppText>
            <AppText style={styles.menuText}>
              Die Salden werden neu berechnet. Geber, Leger und Turbo werden auf
              den gespeicherten Stand vor dieser Runde zurückgesetzt. Später
              gesetzte Leger werden dabei ersetzt. Bei älteren Runden ohne
              Geberprotokoll gilt die aktuelle Sitzreihenfolge.
            </AppText>
            <GoldButton
              title="Runde zurücknehmen"
              accessibilityLabel="Runde zurücknehmen bestätigen"
              onPress={() => {
                if (!useGameStore.getState().undoLastRound())
                  Alert.alert(
                    'Nicht möglich',
                    'Die Runde konnte nicht zurückgenommen werden.',
                  );
                setUndoConfirmVisible(false);
                setRoundSaved(false);
              }}
            />
            <GoldButton
              title="Abbrechen"
              accessibilityLabel="Zurücknehmen abbrechen"
              onPress={() => setUndoConfirmVisible(false)}
            />
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
                    <Text style={styles.playerName}>{player.name}</Text>
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
  onReorder: () => void;
  isDealer: boolean;
  player: RankedPlayer;
  onPressCoin: (playerId: string) => void;
  onPressPlayer: (player: RankedPlayer) => void;
};

const PlayerRankingRow = memo(function PlayerRankingRow({
  onReorder,
  isDealer,
  onPressCoin,
  player,
  onPressPlayer,
}: PlayerRankingRowProps) {
  const isPositive = player.amount > 0;
  const isNegative = player.amount < 0;
  const [hovered, setHovered] = useState(false);
  const handlePress = useCallback(() => {
    onPressPlayer(player);
  }, [onPressPlayer, player]);
  const handlePressCoin = useCallback(() => {
    onPressCoin(player.id);
  }, [onPressCoin, player.id]);

  return (
    <View style={[styles.playerRow, hovered && styles.rowHovered]}>
      <Pressable
        accessibilityLabel={`${player.name}, ${formatAmount(player.amount)}${isDealer ? ', Geber' : ''}`}
        accessibilityRole="button"
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={handlePress}
        onLongPress={onReorder}
        accessibilityHint="Gedrückt halten, um die Sitzreihenfolge zu ändern"
        style={({ pressed }) => [
          styles.playerIdentity,
          pressed && styles.rowPressed,
        ]}
      >
        <CardStackIcon isDealer={isDealer} />
        <View style={styles.playerCopy}>
          <Text style={styles.playerName}>{player.name}</Text>
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
      <CoinMultiplierBadge
        coinCount={player.placedCoins}
        playerName={player.name}
        onPress={handlePressCoin}
      />
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
  onEdit: (round: GameRound) => void;
  round: GameRound;
  getPlayerName: (playerId: string) => string;
};

const HistoryRoundRow = memo(function HistoryRoundRow({
  stockPayoutCents,
  round,
  getPlayerName,
  onEdit,
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
      accessibilityLabel={`Runde ${round.id} bearbeiten`}
      onPress={
        !round.stockAction || ['deposit', 'payout'].includes(round.stockAction)
          ? () => onEdit(round)
          : undefined
      }
      details={
        round.declarerId && round.partnerId
          ? `Spieler: ${getPlayerName(round.declarerId)} · Partner: ${getPlayerName(round.partnerId)} · ${roundWinnerIds(round).includes(round.declarerId) ? 'gewonnen' : 'verloren'}`
          : undefined
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
  draggedPlayerRow: {
    backgroundColor: '#2A4433',
    borderColor: screenColors.gold,
    borderWidth: 1,
    borderRadius: 12,
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
  playerTable: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,245,245,0.1)',
    backgroundColor: 'rgba(20,42,32,0.42)',
    overflow: 'hidden',
  },
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
  addGameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: screenColors.gold,
    borderRadius: 24,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  addGameText: { color: '#15241B', fontSize: 17, fontWeight: '700' },
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
  menuItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: { color: screenColors.text, fontSize: 16 },

  savedNotice: {
    position: 'absolute',
    zIndex: 2,
    left: 20,
    right: 20,
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
  goldGlow: {
    backgroundColor: 'rgba(231, 198, 92, 0.12)',
    borderRadius: 150,
    height: 300,
    position: 'absolute',
    right: -140,
    top: -80,
    width: 300,
  },
  greenGlow: {
    backgroundColor: 'rgba(111, 169, 114, 0.08)',
    borderRadius: 170,
    bottom: 160,
    height: 340,
    left: -170,
    position: 'absolute',
    width: 340,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: authSpacing.sm,
  },
  navPill: { alignItems: 'center', flexDirection: 'row', minHeight: 44 },
  backPill: { gap: 8 },
  archivePill: {
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  navPillText: { color: screenColors.text, fontSize: 18, fontWeight: '600' },
  tableHeader: { marginBottom: 16 },
  tableTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  monthLabel: {
    color: screenColors.gold,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
    textTransform: 'capitalize',
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
    color: screenColors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  statChipValueGold: {
    color: screenColors.gold,
  },
  hero: {
    borderRadius: 32,
    elevation: 12,
    overflow: 'hidden',
    shadowColor: screenColors.shadow,
    shadowOffset: { height: 22, width: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
  },
  heroBlur: {
    backgroundColor: 'rgba(20, 42, 32, 0.78)',
    borderColor: screenColors.border,
    borderRadius: 32,
    borderWidth: 1,
    gap: authSpacing.lg,
    overflow: 'hidden',
    padding: authSpacing.xl,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.md,
    justifyContent: 'space-between',
  },
  heroTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: authSpacing.sm,
    minWidth: 0,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(231, 198, 92, 0.09)',
    borderColor: 'rgba(231, 198, 92, 0.2)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    shadowColor: screenColors.gold,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    width: 44,
  },
  heroTitleCopy: {
    flex: 1,
    minWidth: 0,
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
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '700',
  },
  gameBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(231, 198, 92, 0.1)',
    borderColor: 'rgba(231, 198, 92, 0.28)',
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 76,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  gameBadgeValue: {
    color: screenColors.gold,
    fontSize: 26,
    fontWeight: '900',
  },
  gameBadgeLabel: {
    color: screenColors.soft,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroStats: {
    flexDirection: 'row',
    gap: authSpacing.sm,
  },
  metricTile: {
    backgroundColor: 'rgba(7, 17, 11, 0.46)',
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 74,
    padding: authSpacing.md,
  },
  metricTileGold: {
    backgroundColor: 'rgba(231, 198, 92, 0.1)',
    borderColor: 'rgba(231, 198, 92, 0.22)',
  },
  metricLabel: {
    color: screenColors.soft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: screenColors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: authSpacing.xs,
  },
  metricValueGold: {
    color: screenColors.gold,
  },
  heroFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leaderWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: authSpacing.sm,
    minWidth: 0,
  },
  leaderIcon: {
    alignItems: 'center',
    backgroundColor: screenColors.goldSoft,
    borderRadius: authRadius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  leaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  leaderLabel: {
    color: screenColors.soft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  leaderName: {
    color: screenColors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  historyShortcut: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.06)',
    borderColor: 'rgba(245, 245, 245, 0.09)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.xs,
    minHeight: 44,
    paddingHorizontal: authSpacing.md,
  },
  historyShortcutText: {
    color: screenColors.gold,
    fontSize: 12,
    fontWeight: '900',
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
  segmentButtonActive: {
    backgroundColor: screenColors.gold,
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
  statsButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(231, 198, 92, 0.08)',
    borderColor: 'rgba(231, 198, 92, 0.18)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  roundCountPill: {
    backgroundColor: 'rgba(245, 245, 245, 0.06)',
    borderRadius: authRadius.pill,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  roundCountText: {
    color: screenColors.soft,
    fontSize: 12,
    fontWeight: '900',
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
  playerRowLeader: {
    backgroundColor: 'rgba(231, 198, 92, 0.075)',
    borderBottomColor: 'rgba(231, 198, 92, 0.22)',
    shadowColor: screenColors.gold,
    shadowOpacity: 0.12,
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
  coinBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9C884E',
    backgroundColor: '#B6A16B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBadgeEmpty: { backgroundColor: '#34443A', borderColor: '#6E7969' },
  coinStack: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    position: 'relative',
    width: 46,
  },
  multiplierText: {
    color: '#18251B',
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  multiplierTextMuted: { color: '#CAD0BD' },
  cardIconWrap: {
    height: 46,
    marginRight: authSpacing.xs,
    position: 'relative',
    width: 56,
  },
  cardIcon: {
    borderRadius: 6,
    borderWidth: 2,
    height: 34,
    position: 'absolute',
    shadowOffset: { height: 6, width: 0 },
    shadowRadius: 10,
    top: 6,
    width: 21,
  },
  cardIconDealer: {
    borderWidth: 2.5,
    elevation: 5,
  },
  playerCopy: {
    flex: 1,
    minWidth: 0,
  },
  playerNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.xs,
  },
  playerName: {
    color: screenColors.text,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  leaderBadge: {
    alignItems: 'center',
    backgroundColor: screenColors.goldSoft,
    borderRadius: authRadius.pill,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  playerMeta: {
    color: screenColors.soft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
  },
  finishPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.988 }],
  },
  finishText: { color: screenColors.gold, fontSize: 14, fontWeight: '600' },
  fab: {
    alignItems: 'center',
    backgroundColor: '#3F7A4E',
    borderRadius: authRadius.pill,
    elevation: 14,
    height: 66,
    justifyContent: 'center',
    position: 'absolute',
    right: authSpacing.xl,
    shadowColor: '#6BA36E',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 20,
    width: 66,
  },
  fabPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.94 }],
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  sheet: {
    backgroundColor: '#142A20',
    borderColor: 'rgba(231, 198, 92, 0.18)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    maxHeight: '88%',
    paddingBottom: authSpacing.lg,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.lg,
    shadowColor: screenColors.shadow,
    shadowOffset: { height: -14, width: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetKicker: {
    color: screenColors.gold,
    fontSize: authTypography.caption,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    color: screenColors.text,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.07)',
    borderRadius: authRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sheetContent: {
    gap: authSpacing.md,
    paddingBottom: authSpacing.lg,
    paddingTop: authSpacing.lg,
  },
  label: {
    color: screenColors.muted,
    fontSize: authTypography.caption,
    fontWeight: '900',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
  amountInput: {
    backgroundColor: 'rgba(7, 17, 11, 0.62)',
    borderColor: screenColors.border,
    borderRadius: 22,
    borderWidth: 1,
    color: screenColors.text,
    fontSize: 24,
    fontWeight: '900',
    minHeight: 58,
    paddingHorizontal: authSpacing.lg,
  },
  multiplierHint: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(231, 198, 92, 0.1)',
    borderColor: 'rgba(231, 198, 92, 0.2)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.xs,
  },
  multiplierHintText: {
    color: screenColors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});
