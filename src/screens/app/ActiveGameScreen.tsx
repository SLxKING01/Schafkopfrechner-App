import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BarChart3,
  ChevronRight,
  Crown,
  History,
  Plus,
  ReceiptText,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { AnimalAvatar } from '../../components/game/AnimalAvatar';
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
  rank: number;
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
    sauspiel: 'Sauspiel',
    solo: 'Solo',
    wenz: 'Wenz',
    ramsch: 'Ramsch',
    custom: 'Custom',
  };

  return labels[gameType];
}

function getPlayerVisual(index: number) {
  return {
    accentColor: playerAccents[index % playerAccents.length],
    animalId: playerAnimals[index % playerAnimals.length],
  };
}

export function ActiveGameScreen({ navigation }: ActiveGameScreenProps) {
  const currentTable = useGameStore((state) => state.currentTable);
  const players = useGameStore((state) => state.players);
  const rounds = useGameStore((state) => state.rounds);
  const balances = useGameStore((state) => state.balances);
  const addRound = useGameStore((state) => state.addRound);
  const finishGameDay = useGameStore((state) => state.finishGameDay);
  const [activeTab, setActiveTab] = useState<ActiveTab>('players');
  const [roundComposerVisible, setRoundComposerVisible] = useState(false);
  const [winnerId, setWinnerId] = useState('');
  const [loserIds, setLoserIds] = useState<string[]>([]);
  const [amount, setAmount] = useState('10');
  const [gameType, setGameType] = useState<GameType>('sauspiel');

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
    () => createRankedPlayers(players, balances),
    [balances, players],
  );
  const leader = rankedPlayers[0];
  const recentRounds = useMemo(() => [...rounds].reverse(), [rounds]);
  const numericAmount = useMemo(
    () => Number(amount.replace(',', '.')),
    [amount],
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
    setGameType('sauspiel');
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

  const showStatsPlaceholder = useCallback(() => {
    triggerSelectionHaptic();
    Alert.alert('Statistik', 'Spieler-Details folgen.');
  }, []);

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
      amount: numericAmount,
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
    setRoundComposerVisible(false);
  }, [
    addRound,
    gameType,
    isRoundDraftValid,
    loserIds,
    numericAmount,
    resetRoundDraft,
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

  const selectWinner = useCallback((playerId: string) => {
    triggerSelectionHaptic();
    setWinnerId(playerId);
    setLoserIds((currentLosers) =>
      currentLosers.filter((loserId) => loserId !== playerId),
    );
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
      <Animated.View entering={FadeInDown.duration(420)} style={styles.hero}>
        <BlurView intensity={22} tint="dark" style={styles.heroBlur}>
          <View style={styles.heroTop}>
            <View>
              <AppText style={styles.kicker}>Aktiver Tisch</AppText>
              <Text numberOfLines={1} style={styles.title}>
                {currentTable.name}
              </Text>
            </View>
            <View style={styles.gameBadge}>
              <AppText style={styles.gameBadgeValue}>
                #{rounds.length + 1}
              </AppText>
              <AppText style={styles.gameBadgeLabel}>Spiel</AppText>
            </View>
          </View>

          <View style={styles.heroStats}>
            <MetricTile label="Runden" value={`${rounds.length}`} />
            <MetricTile
              label="Offen"
              tone={openAmount > 0 ? 'gold' : 'default'}
              value={formatAmount(openAmount)}
            />
            <MetricTile label="Umsatz" value={formatAmount(totalTurnover)} />
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.leaderWrap}>
              <View style={styles.leaderIcon}>
                <Crown color={screenColors.gold} size={18} strokeWidth={2.4} />
              </View>
              <View style={styles.leaderCopy}>
                <AppText style={styles.leaderLabel}>Leader</AppText>
                <AppText style={styles.leaderName}>
                  {leader?.name ?? 'Noch offen'}
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityHint="Wechselt zum Spielverlauf dieses Tisches"
              accessibilityLabel="Spielverlauf anzeigen"
              accessibilityRole="button"
              hitSlop={touchHitSlop}
              onPress={showHistoryTab}
              style={({ pressed }) => [
                styles.historyShortcut,
                pressed && styles.pressed,
              ]}
            >
              <History color={screenColors.gold} size={17} strokeWidth={2.4} />
              <AppText style={styles.historyShortcutText}>Verlauf</AppText>
            </Pressable>
          </View>
        </BlurView>
      </Animated.View>

      <View style={styles.segmented}>
        <SegmentButton
          icon={UsersRound}
          label="Players"
          selected={activeTab === 'players'}
          onPress={showPlayersTab}
        />
        <SegmentButton
          icon={History}
          label="Verlauf"
          selected={activeTab === 'history'}
          onPress={showHistoryTab}
        />
      </View>
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
      <Trophy color={screenColors.gold} size={18} strokeWidth={2.4} />
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
          contentContainerStyle={styles.content}
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
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {tableOverviewHeader}
          <Animated.View entering={FadeInUp.duration(260)} style={styles.stack}>
            <View style={styles.sectionHeader}>
              <View>
                <AppText style={styles.sectionTitle}>Ranking</AppText>
                <AppText style={styles.sectionSubtitle}>
                  Salden und Platzierung am Tisch
                </AppText>
              </View>
              <Pressable
                accessibilityHint="Öffnet die Spielerstatistik"
                accessibilityLabel="Statistik anzeigen"
                accessibilityRole="button"
                hitSlop={touchHitSlop}
                onPress={showStatsPlaceholder}
                style={({ pressed }) => [
                  styles.statsButton,
                  pressed && styles.pressed,
                ]}
              >
                <BarChart3
                  color={screenColors.gold}
                  size={18}
                  strokeWidth={2.4}
                />
              </Pressable>
            </View>

            {rankedPlayers.map((player, index) => (
              <PlayerRankingRow
                key={player.id}
                player={player}
                onPressPlayer={showPlayerDetails}
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
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Plus color="#17150B" size={30} strokeWidth={3} />
      </Pressable>

      <RoundComposerModal
        amount={amount}
        gameType={gameType}
        loserIds={loserIds}
        players={players}
        visible={roundComposerVisible}
        winnerId={winnerId}
        onAmountChange={setAmount}
        onClose={closeRoundComposer}
        onGameTypeChange={changeGameType}
        onSave={saveRound}
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
        rank: 0,
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

type MetricTileProps = {
  label: string;
  tone?: 'default' | 'gold';
  value: string;
};

const MetricTile = memo(function MetricTile({
  label,
  tone = 'default',
  value,
}: MetricTileProps) {
  return (
    <View style={[styles.metricTile, tone === 'gold' && styles.metricTileGold]}>
      <AppText style={styles.metricLabel}>{label}</AppText>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={1}
        style={[styles.metricValue, tone === 'gold' && styles.metricValueGold]}
      >
        {value}
      </Text>
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
      style={({ pressed }) => [
        styles.segmentButton,
        selected && styles.segmentButtonActive,
        pressed && styles.pressed,
      ]}
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
  player: RankedPlayer;
  onPressPlayer: (player: RankedPlayer) => void;
};

const PlayerRankingRow = memo(function PlayerRankingRow({
  delay,
  player,
  onPressPlayer,
}: PlayerRankingRowProps) {
  const isPositive = player.amount > 0;
  const isNegative = player.amount < 0;
  const handlePress = useCallback(() => {
    onPressPlayer(player);
  }, [onPressPlayer, player]);

  return (
    <Animated.View entering={FadeInDown.duration(260).delay(delay)}>
      <Pressable
        accessibilityLabel={`${player.name}, Platz ${player.rank}, ${formatAmount(
          player.amount,
        )}`}
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [
          styles.playerRow,
          player.isLeader && styles.playerRowLeader,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.rankBadge}>
          <AppText style={styles.rankText}>{player.rank}</AppText>
        </View>
        <AnimalAvatar
          accentColor={player.accentColor}
          animalId={player.animalId}
          highlighted={player.isLeader}
          size={48}
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
          <AppText style={styles.playerMeta}>
            {player.isLeader ? 'Führt den Tisch' : 'Spieler am Tisch'}
          </AppText>
        </View>
        <Text
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
      </Pressable>
    </Animated.View>
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
  gameType: GameType;
  loserIds: string[];
  players: Player[];
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
  gameType,
  loserIds,
  players,
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
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.xl,
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: authSpacing.md,
    justifyContent: 'space-between',
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
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: authSpacing.xs,
    maxWidth: 230,
  },
  gameBadge: {
    alignItems: 'center',
    backgroundColor: screenColors.goldSoft,
    borderColor: 'rgba(231, 198, 92, 0.28)',
    borderRadius: 22,
    borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: authSpacing.sm,
    paddingVertical: authSpacing.sm,
  },
  gameBadgeValue: {
    color: screenColors.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  gameBadgeLabel: {
    color: screenColors.soft,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
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
    backgroundColor: 'rgba(7, 17, 11, 0.62)',
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.xs,
    marginTop: authSpacing.xl,
    padding: 5,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: authSpacing.xs,
    justifyContent: 'center',
    minHeight: 44,
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
    gap: authSpacing.md,
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
    backgroundColor: screenColors.card,
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.md,
    minHeight: 82,
    padding: authSpacing.md,
    shadowColor: screenColors.shadow,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  playerRowLeader: {
    backgroundColor: 'rgba(42, 57, 35, 0.86)',
    borderColor: 'rgba(231, 198, 92, 0.34)',
    shadowColor: screenColors.gold,
    shadowOpacity: 0.18,
  },
  rowPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.988 }],
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.07)',
    borderRadius: authRadius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  rankText: {
    color: screenColors.gold,
    fontSize: 12,
    fontWeight: '900',
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
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '900',
    maxWidth: 106,
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
    backgroundColor: screenColors.gold,
    borderRadius: authRadius.pill,
    bottom: 28,
    elevation: 14,
    height: 66,
    justifyContent: 'center',
    position: 'absolute',
    right: authSpacing.xl,
    shadowColor: screenColors.gold,
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
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});
