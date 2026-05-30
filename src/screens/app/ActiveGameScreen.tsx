import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  History,
  Plus,
  ReceiptText,
  SlidersHorizontal,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  type ListRenderItem,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { GameTypeSelector } from '../../components/game/GameTypeSelector';
import { MatchHistoryCard } from '../../components/game/MatchHistoryCard';
import { PlayerChip } from '../../components/game/PlayerChip';
import { AppText } from '../../components/ui/AppText';
import { PROFILE_ACCENTS } from '../../constants/profileCustomization';
import type { AppStackScreenProps } from '../../navigation/types';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type {
  GameRound,
  GameType,
  Player,
  PlayerBalance,
  TableGameTypeId,
} from '../../types/game';
import type { AnimalAvatarId } from '../../types/profile';

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

function triggerWarningHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

function formatAmount(amount: number) {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

function formatGameType(gameType: GameType) {
  const labels: Record<GameType, string> = {
    bettel: 'Bettel',
    custom: 'Custom',
    farbgeier: 'Farbgeier',
    farbwenz: 'FarbWenz',
    geier: 'Geier',
    hochzeit: 'Hochzeit',
    kreuzbock: 'Kreuzbock',
    ramsch: 'Ramsch',
    rufspiel: 'Rufspiel',
    sauspiel: 'Sauspiel',
    solo: 'Solo',
    stock: 'Stock',
    wenz: 'Wenz',
  };

  return labels[gameType];
}

function formatTableMonth(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Spieltag';
  }

  return parsedDate.toLocaleDateString('de-DE', { month: 'long' });
}

function getPlayerVisual(index: number) {
  return {
    accentColor: playerAccents[index % playerAccents.length],
    animalId: playerAnimals[index % playerAnimals.length],
  };
}

export function ActiveGameScreen({ navigation }: ActiveGameScreenProps) {
  const insets = useSafeAreaInsets();
  const currentTable = useGameStore((state) => state.currentTable);
  const players = useGameStore((state) => state.players);
  const rounds = useGameStore((state) => state.rounds);
  const balances = useGameStore((state) => state.balances);
  const addRound = useGameStore((state) => state.addRound);
  const finishGameDay = useGameStore((state) => state.finishGameDay);
  const persistGame = useGameStore((state) => state.persistGame);
  const [activeTab, setActiveTab] = useState<ActiveTab>('players');
  const [roundComposerVisible, setRoundComposerVisible] = useState(false);
  const [winnerId, setWinnerId] = useState('');
  const [loserIds, setLoserIds] = useState<string[]>([]);
  const [amount, setAmount] = useState('10');
  const [gameType, setGameType] = useState<GameType>('rufspiel');
  const [placedCoinsByPlayerId, setPlacedCoinsByPlayerId] = useState<
    Record<string, number>
  >({});

  const openAmount = useMemo(
    () =>
      balances.reduce((sum, balance) => sum + Math.max(0, balance.amount), 0),
    [balances],
  );
  const totalTurnover = useMemo(
    () => rounds.reduce((sum, round) => sum + round.amount, 0),
    [rounds],
  );
  const rankedPlayers = useMemo(
    () => createRankedPlayers(players, balances, placedCoinsByPlayerId),
    [balances, placedCoinsByPlayerId, players],
  );
  const leader = rankedPlayers[0];
  const currentDealerId = useMemo(() => {
    if (players.length === 0) {
      return null;
    }

    return players[rounds.length % players.length]?.id ?? null;
  }, [players, rounds.length]);
  const tableMonth = useMemo(
    () => formatTableMonth(currentTable?.createdAt ?? ''),
    [currentTable?.createdAt],
  );
  const recentRounds = useMemo(() => [...rounds].reverse(), [rounds]);
  const enabledGameTypes = useMemo(
    () =>
      Object.entries(currentTable?.settings.games ?? {})
        .filter(([, entry]) => entry.enabled)
        .map(([id]) => id as TableGameTypeId),
    [currentTable?.settings.games],
  );
  const numericAmount = useMemo(
    () => Number(amount.replace(',', '.')),
    [amount],
  );
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
  const roundMultiplier = useMemo(
    () => 2 ** placedCoinCount,
    [placedCoinCount],
  );
  const isRoundDraftValid = useMemo(
    () =>
      Boolean(winnerId) &&
      loserIds.length > 0 &&
      Number.isFinite(numericAmount) &&
      numericAmount > 0,
    [loserIds.length, numericAmount, winnerId],
  );
  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );

  useEffect(() => {
    if (roundComposerVisible) {
      AccessibilityInfo.announceForAccessibility('Rundeneingabe geöffnet');
    }
  }, [roundComposerVisible]);

  useEffect(() => {
    if (
      enabledGameTypes.length > 0 &&
      !enabledGameTypes.includes(gameType as TableGameTypeId)
    ) {
      setGameType(enabledGameTypes[0]);
    }
  }, [enabledGameTypes, gameType]);

  const getPlayerName = useCallback(
    (id: string) => playerNameById.get(id) ?? 'Unbekannt',
    [playerNameById],
  );

  const renderHistoryRound: ListRenderItem<GameRound> = useCallback(
    ({ item }) => (
      <HistoryRoundRow round={item} getPlayerName={getPlayerName} />
    ),
    [getPlayerName],
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

    setActiveTab('players');
  }, [activeTab]);

  const showHistoryTab = useCallback(() => {
    if (activeTab !== 'history') {
      triggerSelectionHaptic();
    }

    setActiveTab('history');
  }, [activeTab]);

  const resetRoundDraft = useCallback(() => {
    setWinnerId('');
    setLoserIds([]);
    setAmount('10');
    setGameType(enabledGameTypes[0] ?? 'rufspiel');
  }, [enabledGameTypes]);

  const resetPlacedCoins = useCallback(() => {
    setPlacedCoinsByPlayerId({});
  }, []);

  const openRoundComposer = useCallback(() => {
    triggerSelectionHaptic();
    setRoundComposerVisible(true);
  }, []);

  const closeRoundComposer = useCallback(() => {
    triggerSelectionHaptic();
    setRoundComposerVisible(false);
    resetRoundDraft();
  }, [resetRoundDraft]);

  const showPlayerDetails = useCallback((player: RankedPlayer) => {
    triggerSelectionHaptic();
    Alert.alert(
      player.name,
      `Aktueller Kontostand: ${formatAmount(player.amount)}`,
    );
  }, []);

  const toggleLoser = useCallback(
    (id: string) => {
      triggerSelectionHaptic();
      setLoserIds((currentLosers) => {
        if (id === winnerId) {
          return currentLosers;
        }

        return currentLosers.includes(id)
          ? currentLosers.filter((loserId) => loserId !== id)
          : [...currentLosers, id];
      });
    },
    [winnerId],
  );

  const changeGameType = useCallback((nextGameType: GameType) => {
    triggerSelectionHaptic();
    setGameType(nextGameType);
  }, []);

  const saveRound = useCallback(() => {
    if (!isRoundDraftValid) {
      triggerWarningHaptic();
      Alert.alert('Betrag prüfen', 'Bitte gib einen gültigen Betrag ein.');
      return;
    }

    const didAdd = addRound({
      winnerId,
      loserIds,
      amount: numericAmount * roundMultiplier,
      gameType,
    });

    if (!didAdd) {
      triggerWarningHaptic();
      Alert.alert(
        'Runde unvollständig',
        'Bitte Gewinner, mindestens einen Verlierer und Betrag > 0 wählen.',
      );
      return;
    }

    triggerSaveHaptic();
    resetRoundDraft();
    resetPlacedCoins();
    setRoundComposerVisible(false);
  }, [
    addRound,
    gameType,
    isRoundDraftValid,
    loserIds,
    numericAmount,
    resetPlacedCoins,
    resetRoundDraft,
    roundMultiplier,
    winnerId,
  ]);

  const finishDay = useCallback(() => {
    triggerSelectionHaptic();
    const didFinish = finishGameDay();

    if (!didFinish) {
      Alert.alert('Kein aktiver Spieltag', 'Starte zuerst einen Spieltisch.');
      return;
    }

    navigation.navigate('Settlement');
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

  const goToTablesOverview = useCallback(() => {
    triggerSelectionHaptic();

    void persistGame().finally(() => {
      navigation.navigate('AppTabs', { screen: 'GameLobby' });
    });
  }, [navigation, persistGame]);

  const selectWinner = useCallback((playerId: string) => {
    triggerSelectionHaptic();
    setWinnerId(playerId);
    setLoserIds((currentLosers) =>
      currentLosers.filter((loserId) => loserId !== playerId),
    );
  }, []);

  const togglePlacedCoin = useCallback((playerId: string) => {
    triggerSelectionHaptic();

    setPlacedCoinsByPlayerId((currentCoins) => {
      const currentCoinCount = normalizeCoinCount(currentCoins[playerId]);
      const nextCoins = { ...currentCoins };

      if (currentCoinCount > 0) {
        delete nextCoins[playerId];
      } else {
        nextCoins[playerId] = 1;
      }

      return nextCoins;
    });
  }, []);

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
      <Animated.View entering={FadeInDown.duration(360)} style={styles.topBar}>
        <Pressable
          accessibilityHint="Kehrt zur Tische-Übersicht zurück, ohne den Spieltag zu beenden"
          accessibilityLabel="Zurück zu Tische"
          accessibilityRole="button"
          hitSlop={touchHitSlop}
          onPress={goToTablesOverview}
          style={({ pressed }) => [
            styles.navPill,
            styles.backPill,
            pressed && styles.pressed,
          ]}
        >
          <ArrowLeft color={screenColors.text} size={24} strokeWidth={2.7} />
          <AppText style={styles.navPillText}>Tische</AppText>
        </Pressable>
        <View style={styles.topBarActions}>
          <Pressable
            accessibilityHint="Öffnet Regeln und Tarife für diesen Tisch"
            accessibilityLabel="Tisch bearbeiten"
            accessibilityRole="button"
            hitSlop={touchHitSlop}
            onPress={openTableSettings}
            style={({ pressed }) => [
              styles.navPill,
              styles.archivePill,
              pressed && styles.pressed,
            ]}
          >
            <SlidersHorizontal
              color={screenColors.gold}
              size={21}
              strokeWidth={2.5}
            />
          </Pressable>
          <Pressable
            accessibilityHint="Archiviert den Tisch nach Bestätigung"
            accessibilityLabel="Tisch archivieren"
            accessibilityRole="button"
            hitSlop={touchHitSlop}
            onPress={confirmArchiveTable}
            style={({ pressed }) => [
              styles.navPill,
              styles.archivePill,
              pressed && styles.pressed,
            ]}
          >
            <Trash2 color={screenColors.gold} size={22} strokeWidth={2.5} />
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(360).delay(60)}
        style={styles.tableHeader}
      >
        <View style={styles.tableTitleBlock}>
          <Text numberOfLines={1} style={styles.title}>
            {currentTable.name}
          </Text>
          <AppText style={styles.monthLabel}>{tableMonth}</AppText>
        </View>
        <View style={styles.gameBadge}>
          <AppText style={styles.gameBadgeLabel}>Spiel</AppText>
          <AppText style={styles.gameBadgeValue}>{rounds.length + 1}</AppText>
        </View>
      </Animated.View>

      <View style={styles.compactStats}>
        <View style={styles.statChip}>
          <AppText style={styles.statChipLabel}>Offen</AppText>
          <Text
            numberOfLines={1}
            style={[
              styles.statChipValue,
              openAmount > 0 && styles.statChipValueGold,
            ]}
          >
            {formatAmount(openAmount)}
          </Text>
        </View>
        <View style={styles.statChip}>
          <AppText style={styles.statChipLabel}>Umsatz</AppText>
          <Text numberOfLines={1} style={styles.statChipValue}>
            {formatAmount(totalTurnover)}
          </Text>
        </View>
        <View style={styles.statChip}>
          <AppText style={styles.statChipLabel}>Leader</AppText>
          <Text numberOfLines={1} style={styles.statChipValue}>
            {leader?.name ?? 'Offen'}
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
      <View style={styles.goldGlow} pointerEvents="none" />
      <View style={styles.greenGlow} pointerEvents="none" />

      {activeTab === 'history' ? (
        <FlatList
          style={styles.scroller}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 18) + 118 },
          ]}
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
              message="Tippe auf +, um das erste Spiel zu erfassen."
            />
          }
          ListFooterComponent={finishDayButton}
          ListHeaderComponent={
            <>
              {tableOverviewHeader}
              <Animated.View
                entering={FadeInUp.duration(260)}
                style={[styles.stack, styles.historyHeaderStack]}
              >
                <View style={styles.sectionHeader}>
                  <View>
                    <AppText style={styles.sectionTitle}>Spielverlauf</AppText>
                    <AppText style={styles.sectionSubtitle}>
                      Letzte Runden und Gewinner
                    </AppText>
                  </View>
                  <View style={styles.roundCountPill}>
                    <AppText style={styles.roundCountText}>
                      {rounds.length} Runden
                    </AppText>
                  </View>
                </View>
              </Animated.View>
            </>
          }
        />
      ) : (
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 18) + 118 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {tableOverviewHeader}
          <Animated.View entering={FadeInUp.duration(260)} style={styles.stack}>
            <View style={styles.sectionHeader}>
              <View>
                <AppText style={styles.sectionTitle}>Spieler</AppText>
              </View>
              <AppText style={styles.sectionSubtitle}>
                {rankedPlayers.length} Spieler
              </AppText>
            </View>

            {rankedPlayers.map((player, index) => (
              <PlayerRankingRow
                key={player.id}
                isDealer={player.id === currentDealerId}
                player={player}
                onPressPlayer={showPlayerDetails}
                onPressCoin={togglePlacedCoin}
                delay={index * 55}
              />
            ))}
          </Animated.View>

          {finishDayButton}
        </ScrollView>
      )}

      <Pressable
        accessibilityLabel="Runde hinzufügen"
        accessibilityRole="button"
        hitSlop={touchHitSlop}
        onPress={openRoundComposer}
        style={({ pressed }) => [
          styles.fab,
          { bottom: Math.max(insets.bottom, 18) + 18 },
          pressed && styles.fabPressed,
        ]}
      >
        <Plus color={screenColors.text} size={30} strokeWidth={3} />
      </Pressable>

      <RoundComposerModal
        amount={amount}
        enabledGameTypes={enabledGameTypes}
        gameType={gameType}
        loserIds={loserIds}
        players={players}
        visible={roundComposerVisible}
        winnerId={winnerId}
        onAmountChange={setAmount}
        onClose={closeRoundComposer}
        onGameTypeChange={changeGameType}
        onSave={saveRound}
        roundMultiplier={roundMultiplier}
        saveDisabled={!isRoundDraftValid}
        onSelectWinner={selectWinner}
        onToggleLoser={toggleLoser}
      />
    </AuthBackground>
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
    .sort(
      (firstPlayer, secondPlayer) => secondPlayer.amount - firstPlayer.amount,
    )
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
  delay: number;
  isDealer: boolean;
  player: RankedPlayer;
  onPressCoin: (playerId: string) => void;
  onPressPlayer: (player: RankedPlayer) => void;
};

const PlayerRankingRow = memo(function PlayerRankingRow({
  delay,
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
    <Animated.View entering={FadeInDown.duration(260).delay(delay)}>
      <Pressable
        accessibilityLabel={`${player.name}, ${formatAmount(
          player.amount,
        )}, ${player.placedCoins} gelegte Münzen, Multiplikator ${getMultiplierLabel(
          player.placedCoins,
        )}`}
        accessibilityRole="button"
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.playerRow,
          player.isLeader && styles.playerRowLeader,
          hovered && styles.rowHovered,
          pressed && styles.rowPressed,
        ]}
      >
        <CardStackIcon
          accentColor={player.accentColor}
          isDealer={isDealer}
          seatIndex={player.seatIndex}
        />
        <View style={styles.playerCopy}>
          <View style={styles.playerNameRow}>
            <Text numberOfLines={1} style={styles.playerName}>
              {player.name}
            </Text>
            {player.isLeader ? (
              <View style={styles.leaderBadge}>
                <Crown color={screenColors.gold} size={11} strokeWidth={2.7} />
              </View>
            ) : null}
          </View>
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
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
          onPress={handlePressCoin}
        />
        <ChevronRight
          color="rgba(245, 245, 245, 0.5)"
          size={22}
          strokeWidth={2.4}
        />
      </Pressable>
    </Animated.View>
  );
});

type CardStackIconProps = {
  accentColor: string;
  isDealer: boolean;
  seatIndex: number;
};

const CardStackIcon = memo(function CardStackIcon({
  accentColor,
  isDealer,
  seatIndex,
}: CardStackIconProps) {
  const cardColors = [
    PROFILE_ACCENTS.forestGreen,
    PROFILE_ACCENTS.amber,
    PROFILE_ACCENTS.mutedBlue,
    PROFILE_ACCENTS.warmRed,
  ];
  const activeCardIndex = seatIndex % cardColors.length;

  return (
    <View style={styles.cardIconWrap}>
      {cardColors.map((cardColor, index) => {
        const isActiveDealerCard = isDealer && index === activeCardIndex;

        return (
          <View
            key={cardColor}
            style={[
              styles.cardIcon,
              {
                backgroundColor: isActiveDealerCard
                  ? cardColor
                  : 'rgba(7, 17, 11, 0.3)',
                borderColor: isActiveDealerCard ? screenColors.gold : cardColor,
                left: 4 + index * 9,
                shadowColor: isActiveDealerCard
                  ? screenColors.gold
                  : accentColor,
                shadowOpacity: isActiveDealerCard ? 0.3 : 0,
                transform: [{ rotate: `${-10 + index * 6}deg` }],
                zIndex: isActiveDealerCard ? 6 : index,
              },
              isActiveDealerCard && styles.cardIconDealer,
            ]}
          />
        );
      })}
    </View>
  );
});

type CoinMultiplierBadgeProps = {
  coinCount: number;
  maxCoins?: number;
  onPress?: () => void;
};

function normalizeCoinCount(coinCount: number, maxCoins = 4) {
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
  coinCount,
  maxCoins = 4,
  onPress,
}: CoinMultiplierBadgeProps) {
  const safeCoinCount = normalizeCoinCount(coinCount, maxCoins);
  const multiplierLabel = `${2 ** safeCoinCount}x`;
  const progress = maxCoins > 0 ? safeCoinCount / maxCoins : 0;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withSpring(1.08, { damping: 12, stiffness: 260 }, () => {
      scale.value = withSpring(1, { damping: 14, stiffness: 220 });
    });
  }, [safeCoinCount, scale]);

  const coins = Array.from({ length: safeCoinCount });
  const isEmpty = safeCoinCount === 0;
  const glowOpacity = 0.12 + progress * 0.32;
  const coinTint = safeCoinCount === maxCoins ? '#F9DB78' : screenColors.gold;

  return (
    <Pressable
      accessibilityHint="Markiert, ob dieser Spieler in der aktuellen Runde einmal gelegt hat"
      accessibilityLabel={`${safeCoinCount} gelegte Münzen, Multiplikator ${multiplierLabel}`}
      accessibilityRole="button"
      hitSlop={touchHitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.coinBadgeTapTarget,
        pressed && styles.coinBadgePressed,
      ]}
    >
      <Animated.View
        style={[
          styles.coinBadge,
          isEmpty && styles.coinBadgeEmpty,
          !isEmpty && {
            borderColor: `rgba(231, 198, 92, ${0.34 + progress * 0.36})`,
            shadowOpacity: glowOpacity,
          },
          animatedStyle,
        ]}
      >
        <View style={styles.coinStack}>
          {isEmpty ? (
            <EuroStyleCoin label={multiplierLabel} muted />
          ) : (
            coins.map((_, index) => {
              const offset = index * -5;
              const opacity = 0.78 + (index + 1) * (0.2 / safeCoinCount);
              const isTopCoin = index === safeCoinCount - 1;

              return (
                <View
                  key={`coin-${index}`}
                  style={{
                    opacity,
                    position: 'absolute',
                    transform: [{ translateY: offset }],
                    zIndex: index + 1,
                  }}
                >
                  <EuroStyleCoin
                    label={isTopCoin ? multiplierLabel : ''}
                    tint={coinTint}
                  />
                </View>
              );
            })
          )}
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[styles.multiplierText, isEmpty && styles.multiplierTextMuted]}
        >
          {multiplierLabel}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

type EuroStyleCoinProps = {
  label: string;
  muted?: boolean;
  tint?: string;
};

const ridgeLines = Array.from({ length: 14 });

const EuroStyleCoin = memo(function EuroStyleCoin({
  label,
  muted = false,
  tint = screenColors.gold,
}: EuroStyleCoinProps) {
  const faceColor = muted ? 'rgba(245, 245, 245, 0.055)' : tint;
  const sideColor = muted ? 'rgba(245, 245, 245, 0.08)' : '#B88322';
  const edgeColor = muted ? 'rgba(245, 245, 245, 0.26)' : '#FFF0A7';
  const imprintColor = muted ? 'rgba(245, 245, 245, 0.38)' : '#3B2B0A';
  const ridgeColor = muted ? 'rgba(245, 245, 245, 0.26)' : '#FFF4BC';

  return (
    <Svg height={34} viewBox="0 0 52 38" width={46}>
      <Ellipse cx="24" cy="31" fill="rgba(0,0,0,0.22)" rx="20" ry="5" />
      <Rect
        fill={sideColor}
        height="9"
        rx="2"
        stroke={edgeColor}
        strokeWidth="1"
        width="42"
        x="5"
        y="18"
      />
      <G>
        {ridgeLines.map((_, index) => {
          const x = 8 + index * 2.8;

          return (
            <Line
              key={`ridge-${index}`}
              stroke={ridgeColor}
              strokeLinecap="round"
              strokeWidth="1.2"
              x1={x}
              x2={x}
              y1="20"
              y2="28"
            />
          );
        })}
      </G>
      <Ellipse
        cx="26"
        cy="17"
        fill={faceColor}
        rx="22"
        ry="13"
        stroke={edgeColor}
        strokeWidth="1.6"
      />
      <Ellipse
        cx="26"
        cy="17"
        fill="transparent"
        rx="17"
        ry="9"
        stroke={imprintColor}
        strokeOpacity={muted ? 0.48 : 0.34}
        strokeWidth="1"
      />
      <Ellipse
        cx="26"
        cy="17"
        fill="transparent"
        rx="20"
        ry="11.4"
        stroke={imprintColor}
        strokeOpacity={muted ? 0.42 : 0.28}
        strokeWidth="1"
      />
      {label ? (
        <SvgText
          fill={imprintColor}
          fontSize="13"
          fontWeight="900"
          textAnchor="middle"
          x="25.5"
          y="20.7"
        >
          {label}
        </SvgText>
      ) : null}
      <G opacity={muted ? 0.34 : 0.6}>
        <Line
          stroke={edgeColor}
          strokeLinecap="round"
          strokeWidth="1"
          x1="35"
          x2="39"
          y1="10"
          y2="8"
        />
        <Line
          stroke={edgeColor}
          strokeLinecap="round"
          strokeWidth="1"
          x1="38"
          x2="42"
          y1="13"
          y2="12"
        />
        <Line
          stroke={edgeColor}
          strokeLinecap="round"
          strokeWidth="1"
          x1="36"
          x2="41"
          y1="18"
          y2="19"
        />
      </G>
    </Svg>
  );
});

type HistoryRoundRowProps = {
  round: GameRound;
  getPlayerName: (playerId: string) => string;
};

const HistoryRoundRow = memo(function HistoryRoundRow({
  round,
  getPlayerName,
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
    () => getPlayerName(round.winnerId),
    [getPlayerName, round.winnerId],
  );

  return (
    <MatchHistoryCard
      amount={formatAmount(round.amount)}
      gameType={formatGameType(round.gameType)}
      losers={losers}
      time={time}
      winner={winner}
    />
  );
});

type RoundPlayerChipProps = {
  disabled?: boolean;
  name: string;
  playerId: string;
  selected: boolean;
  type: 'winner' | 'loser';
  onPressPlayer: (playerId: string) => void;
};

const RoundPlayerChip = memo(function RoundPlayerChip({
  disabled = false,
  name,
  playerId,
  selected,
  type,
  onPressPlayer,
}: RoundPlayerChipProps) {
  const handlePress = useCallback(() => {
    onPressPlayer(playerId);
  }, [onPressPlayer, playerId]);

  return (
    <PlayerChip
      accessibilityHint={
        type === 'winner'
          ? 'Wählt diesen Spieler als Gewinner aus'
          : 'Wählt diesen Spieler als Verlierer aus oder entfernt ihn'
      }
      accessibilityLabel={`${name} als ${
        type === 'winner' ? 'Gewinner' : 'Verlierer'
      } ${selected ? 'ausgewählt' : 'auswählen'}`}
      disabled={disabled}
      name={name}
      selected={selected}
      onPress={handlePress}
    />
  );
});

type RoundComposerModalProps = {
  amount: string;
  enabledGameTypes: GameType[];
  gameType: GameType;
  loserIds: string[];
  players: Player[];
  roundMultiplier: number;
  saveDisabled: boolean;
  visible: boolean;
  winnerId: string;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onGameTypeChange: (gameType: GameType) => void;
  onSave: () => void;
  onSelectWinner: (playerId: string) => void;
  onToggleLoser: (playerId: string) => void;
};

const RoundComposerModal = memo(function RoundComposerModal({
  amount,
  enabledGameTypes,
  gameType,
  loserIds,
  players,
  roundMultiplier,
  saveDisabled,
  visible,
  winnerId,
  onAmountChange,
  onClose,
  onGameTypeChange,
  onSave,
  onSelectWinner,
  onToggleLoser,
}: RoundComposerModalProps) {
  const loserIdSet = useMemo(() => new Set(loserIds), [loserIds]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityHint="Verwirft die aktuelle Rundeneingabe"
          accessibilityLabel="Rundeneingabe schließen"
          accessibilityRole="button"
          hitSlop={touchHitSlop}
          onPress={onClose}
          style={styles.modalBackdrop}
        />
        <Animated.View
          accessibilityViewIsModal
          entering={FadeInUp.duration(220)}
          importantForAccessibility="yes"
          style={styles.sheet}
        >
          <View style={styles.sheetHeader}>
            <View>
              <AppText style={styles.sheetKicker}>Neue Runde</AppText>
              <AppText style={styles.sheetTitle}>Spiel erfassen</AppText>
            </View>
            <Pressable
              accessibilityHint="Verwirft die aktuelle Rundeneingabe"
              accessibilityLabel="Rundeneingabe schließen"
              accessibilityRole="button"
              hitSlop={touchHitSlop}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <X color={screenColors.gold} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppText style={styles.label}>Gewinner</AppText>
            <View style={styles.chipWrap}>
              {players.map((player) => (
                <RoundPlayerChip
                  key={player.id}
                  name={player.name}
                  playerId={player.id}
                  selected={winnerId === player.id}
                  type="winner"
                  onPressPlayer={onSelectWinner}
                />
              ))}
            </View>

            <AppText style={styles.label}>Verlierer</AppText>
            <View style={styles.chipWrap}>
              {players.map((player) => (
                <RoundPlayerChip
                  key={player.id}
                  disabled={player.id === winnerId}
                  name={player.name}
                  playerId={player.id}
                  selected={loserIdSet.has(player.id)}
                  type="loser"
                  onPressPlayer={onToggleLoser}
                />
              ))}
            </View>

            <AppText style={styles.label}>Spieltyp</AppText>
            <GameTypeSelector
              enabledTypes={enabledGameTypes}
              selectedType={gameType}
              onSelect={onGameTypeChange}
            />

            <AppText style={styles.label}>Betrag</AppText>
            <TextInput
              accessibilityHint="Gib den Einsatzbetrag für diese Runde ein"
              accessibilityLabel="Betrag"
              keyboardAppearance="dark"
              keyboardType="decimal-pad"
              placeholder="10"
              placeholderTextColor={authColors.textSecondary}
              selectionColor={authColors.gold}
              style={styles.amountInput}
              value={amount}
              onChangeText={onAmountChange}
            />
            <View style={styles.multiplierHint}>
              <AppText style={styles.multiplierHintText}>
                Legen aktiv: {roundMultiplier}x
              </AppText>
            </View>

            <GoldButton
              accessibilityHint="Speichert die Runde, sobald Gewinner, Verlierer und Betrag gültig sind"
              accessibilityLabel="Runde speichern"
              disabled={saveDisabled}
              title="Runde speichern"
              onPress={onSave}
            />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingBottom: 132,
    paddingHorizontal: 20,
    paddingTop: authSpacing.lg,
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
    marginBottom: authSpacing.xl,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: authSpacing.sm,
  },
  navPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.06)',
    borderColor: 'rgba(231, 198, 92, 0.16)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    shadowColor: screenColors.gold,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
  },
  backPill: {
    gap: authSpacing.sm,
    paddingLeft: authSpacing.md,
    paddingRight: authSpacing.lg,
  },
  archivePill: {
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  navPillText: {
    color: screenColors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  tableHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: authSpacing.md,
    justifyContent: 'space-between',
    marginBottom: authSpacing.md,
  },
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
    gap: authSpacing.sm,
    marginBottom: authSpacing.lg,
  },
  statChip: {
    backgroundColor: 'rgba(245, 245, 245, 0.045)',
    borderColor: 'rgba(245, 245, 245, 0.075)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  statChipLabel: {
    color: screenColors.soft,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statChipValue: {
    color: screenColors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
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
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
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
    minHeight: 54,
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
    minHeight: 48,
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
  stack: {
    gap: 0,
    marginTop: authSpacing.xl,
  },
  historyHeaderStack: {
    marginBottom: authSpacing.md,
  },
  historySeparator: {
    height: authSpacing.md,
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
    alignItems: 'center',
    backgroundColor: 'rgba(20, 42, 32, 0.36)',
    borderBottomColor: 'rgba(245, 245, 245, 0.08)',
    borderBottomWidth: 1,
    borderRadius: 0,
    flexDirection: 'row',
    gap: authSpacing.md,
    minHeight: 88,
    paddingHorizontal: authSpacing.sm,
    paddingVertical: authSpacing.md,
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
    borderRadius: 20,
  },
  coinBadgePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
  coinBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(231, 198, 92, 0.12)',
    borderColor: 'rgba(231, 198, 92, 0.42)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 46,
    justifyContent: 'center',
    shadowColor: screenColors.gold,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    width: 82,
  },
  coinBadgeEmpty: {
    backgroundColor: 'rgba(245, 245, 245, 0.045)',
    borderColor: 'rgba(245, 245, 245, 0.12)',
    shadowOpacity: 0,
  },
  coinStack: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    position: 'relative',
    width: 46,
  },
  multiplierText: {
    color: screenColors.gold,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 24,
  },
  multiplierTextMuted: {
    color: screenColors.soft,
  },
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
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '900',
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
    fontSize: 18,
    fontWeight: '900',
    maxWidth: 112,
    minWidth: 86,
    textAlign: 'right',
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
    alignSelf: 'stretch',
    backgroundColor: 'rgba(245, 245, 245, 0.055)',
    borderColor: 'rgba(231, 198, 92, 0.14)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.sm,
    justifyContent: 'center',
    marginTop: authSpacing.xl,
    minHeight: 58,
    paddingHorizontal: authSpacing.lg,
  },
  finishPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.988 }],
  },
  finishText: {
    color: screenColors.gold,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
  },
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
    ...StyleSheet.absoluteFillObject,
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
