import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { AppSection } from '../components/ui/AppSection';
import { AppText } from '../components/ui/AppText';
import { getGameTypeById } from '../constants/gameTypes';
import { theme } from '../constants/theme';
import type { Balance } from '../models/Balance';
import type { Game } from '../models/Game';
import type { Settlement } from '../models/Settlement';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import { calculateBalances } from '../utils/calculateBalances';
import { calculateBaseAmount } from '../utils/calculateBaseAmount';
import { formatGameAmountSummary } from '../utils/calculateGameAmount';
import { calculateSettlements } from '../utils/calculateSettlements';
import { getActiveMatchDayGames } from '../utils/getActiveMatchDayGames';

type HomeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Games'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigationProp>();
  const games = useGameStore((state) => state.games);
  const removeGame = useGameStore((state) => state.removeGame);
  const undoLastGame = useGameStore((state) => state.undoLastGame);
  const matchDays = useMatchDayStore((state) => state.matchDays);
  const activeMatchDayId = useMatchDayStore((state) => state.activeMatchDayId);
  const players = usePlayerStore((state) => state.players);
  const activeMatchDay = matchDays.find(
    (matchDay) => matchDay.id === activeMatchDayId,
  );
  const activeGames = useMemo(
    () => getActiveMatchDayGames(games, activeMatchDayId),
    [games, activeMatchDayId],
  );
  const balances = useMemo(
    () => calculateBalances(players, activeGames),
    [players, activeGames],
  );
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);
  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );

  const getPlayerName = useCallback(
    (id: string) => playerNameById.get(id) ?? 'Unbekannt',
    [playerNameById],
  );

  function formatAmount(amount: number) {
    return `${amount.toFixed(2).replace('.', ',')} €`;
  }

  function getBalanceStyle(amount: number) {
    if (amount > 0) {
      return styles.positiveBalance;
    }

    if (amount < 0) {
      return styles.negativeBalance;
    }

    return styles.neutralBalance;
  }

  function renderBalance({ item }: { item: Balance }) {
    return (
      <View style={styles.row}>
        <AppText style={styles.rowName}>{getPlayerName(item.playerId)}</AppText>
        <AppText style={[styles.rowAmount, getBalanceStyle(item.amount)]}>
          {formatAmount(item.amount)}
        </AppText>
      </View>
    );
  }

  function renderSettlement({ item }: { item: Settlement }) {
    return (
      <AppText>
        {getPlayerName(item.fromPlayerId)} zahlt{' '}
        {getPlayerName(item.toPlayerId)} {formatAmount(item.amount)}
      </AppText>
    );
  }

  function renderGame({ item }: { item: Game }) {
    const calculatedAmountSummary = formatGameAmountSummary(
      item.gameTypeId,
      item.options,
    );

    return (
      <AppCard style={styles.gameCard}>
        <View style={styles.gameHeader}>
          <View style={styles.gameInfo}>
            <AppText variant="subtitle">{getPlayerName(item.winnerId)}</AppText>
            <AppText variant="caption">
              {getGameTypeById(item.gameTypeId).name}
            </AppText>
          </View>
          <View style={styles.gameActions}>
            <AppButton
              title="Bearbeiten"
              variant="secondary"
              onPress={() =>
                navigation.navigate('CreateGame', { gameId: item.id })
              }
              disabled={activeMatchDay?.isClosed}
            />
            <AppButton
              title="Löschen"
              variant="danger"
              onPress={() => removeGame(item.id)}
              disabled={activeMatchDay?.isClosed}
            />
          </View>
        </View>
        <AppText>
          Basisbetrag: {formatAmount(calculateBaseAmount(item.gameTypeId))}
        </AppText>
        <AppText>Tatsächlicher Betrag: {formatAmount(item.amount)}</AppText>
        <AppText>
          {calculatedAmountSummary} = {formatAmount(item.amount)}
        </AppText>
        <AppText variant="caption">Verlierer: {item.loserIds.length}</AppText>
      </AppCard>
    );
  }

  return (
    <View style={styles.container}>
      <AppText variant="title">Schafkopfrechner</AppText>

      <AppCard style={styles.matchDayCard}>
        <AppText variant="caption">Aktiver Spieltag</AppText>
        <AppText variant="subtitle">
          {activeMatchDay?.name ?? 'Kein Spieltag'}
        </AppText>
        {activeMatchDay?.isClosed ? (
          <AppText variant="caption">Abgeschlossen</AppText>
        ) : null}
      </AppCard>

      <AppButton
        title="Spieltag abschließen"
        onPress={() => navigation.navigate('CloseMatchDay')}
        disabled={!activeMatchDay || activeMatchDay.isClosed}
      />

      <AppSection title="Salden">
        {players.length === 0 ? (
          <EmptyState
            title="Noch keine Spieler"
            message="Lege zuerst Spieler an, damit Salden berechnet werden können."
            actionLabel="Spieler anlegen"
            onAction={() => navigation.navigate('Players')}
          />
        ) : (
          <FlatList
            data={balances}
            keyExtractor={(balance) => balance.playerId}
            renderItem={renderBalance}
            contentContainerStyle={styles.compactList}
          />
        )}
      </AppSection>

      <AppSection title="Auszahlungen">
        {settlements.length === 0 ? (
          <EmptyState
            title="Keine Auszahlungen offen"
            message="Sobald Salden entstehen, zeigen wir hier die passenden Zahlungen."
          />
        ) : (
          <FlatList
            data={settlements}
            keyExtractor={(settlement) =>
              `${settlement.fromPlayerId}-${settlement.toPlayerId}-${settlement.amount}`
            }
            renderItem={renderSettlement}
            contentContainerStyle={styles.compactList}
          />
        )}
      </AppSection>

      <AppSection title="Spiele">
        <AppButton
          title="Letztes Spiel rückgängig"
          variant="secondary"
          onPress={undoLastGame}
          disabled={!activeMatchDay || activeMatchDay.isClosed}
        />
        {activeGames.length === 0 ? (
          <EmptyState
            title="Noch keine Spiele"
            message="Erfasse das erste Spiel dieses Spieltags."
            actionLabel="Neues Spiel"
            onAction={() => navigation.navigate('CreateGame')}
          />
        ) : (
          <FlatList
            data={activeGames}
            keyExtractor={(game) => game.id}
            renderItem={renderGame}
            contentContainerStyle={styles.list}
          />
        )}
      </AppSection>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
  },
  matchDayCard: {
    gap: theme.spacing.xs,
  },
  compactList: {
    gap: theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  rowName: {
    flex: 1,
  },
  rowAmount: {
    fontWeight: '600',
  },
  positiveBalance: {
    color: theme.colors.positive,
  },
  negativeBalance: {
    color: theme.colors.negative,
  },
  neutralBalance: {
    color: theme.colors.textMuted,
  },
  gameCard: {
    gap: theme.spacing.sm,
  },
  gameHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  gameInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  gameActions: {
    gap: theme.spacing.sm,
  },
});
