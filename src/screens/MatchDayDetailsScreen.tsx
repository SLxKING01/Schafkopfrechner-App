import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { AppCard } from '../components/ui/AppCard';
import { AppSection } from '../components/ui/AppSection';
import { AppText } from '../components/ui/AppText';
import { getGameTypeById } from '../constants/gameTypes';
import { theme } from '../constants/theme';
import type { Balance } from '../models/Balance';
import type { Game } from '../models/Game';
import type { PlayerStats } from '../models/PlayerStats';
import type { Settlement } from '../models/Settlement';
import type { RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import { calculateBaseAmount } from '../utils/calculateBaseAmount';
import { formatGameAmountSummary } from '../utils/calculateGameAmount';
import { calculateMatchDaySummary } from '../utils/calculateMatchDaySummary';

type MatchDayDetailsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'MatchDayDetails'
>;

export function MatchDayDetailsScreen({ route }: MatchDayDetailsScreenProps) {
  const { matchDayId } = route.params;
  const games = useGameStore((state) => state.games);
  const players = usePlayerStore((state) => state.players);
  const matchDays = useMatchDayStore((state) => state.matchDays);
  const matchDay = matchDays.find((item) => item.id === matchDayId);
  const summary = calculateMatchDaySummary(players, games, matchDayId);

  if (!matchDay) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Spieltag nicht gefunden"
          message="Dieser Spieltag ist nicht mehr vorhanden."
        />
      </View>
    );
  }

  function getPlayerName(id?: string) {
    return players.find((player) => player.id === id)?.name ?? 'Unbekannt';
  }

  function formatAmount(amount: number) {
    return `${amount.toFixed(2).replace('.', ',')} \u20ac`;
  }

  function formatWinRate(winRate: number) {
    return `${winRate.toFixed(1).replace('.', ',')} %`;
  }

  function getAmountStyle(amount: number) {
    if (amount > 0) {
      return styles.positiveAmount;
    }

    if (amount < 0) {
      return styles.negativeAmount;
    }

    return styles.neutralAmount;
  }

  function renderGame({ item }: { item: Game }) {
    const calculatedAmountSummary = formatGameAmountSummary(
      item.gameTypeId,
      item.options,
    );

    return (
      <AppCard style={styles.card}>
        <AppText variant="subtitle">{getPlayerName(item.winnerId)}</AppText>
        <AppText variant="caption">
          {getGameTypeById(item.gameTypeId).name}
        </AppText>
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

  function renderBalance({ item }: { item: Balance }) {
    return (
      <View style={styles.row}>
        <AppText style={styles.rowName}>{getPlayerName(item.playerId)}</AppText>
        <AppText style={[styles.rowAmount, getAmountStyle(item.amount)]}>
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

  function renderPlayerStats({ item }: { item: PlayerStats }) {
    const favoriteGameTypeName = item.favoriteGameTypeId
      ? getGameTypeById(item.favoriteGameTypeId).name
      : 'Keine Spiele';

    return (
      <AppCard style={styles.card}>
        <View style={styles.row}>
          <AppText variant="subtitle" style={styles.rowName}>
            {getPlayerName(item.playerId)}
          </AppText>
          <AppText style={[styles.rowAmount, getAmountStyle(item.totalAmount)]}>
            {formatAmount(item.totalAmount)}
          </AppText>
        </View>
        <AppText>Winrate: {formatWinRate(item.winRate)}</AppText>
        <AppText>
          {item.wins} Siege / {item.losses} Niederlagen
        </AppText>
        <AppText variant="caption">
          Lieblingsspieltyp: {favoriteGameTypeName}
        </AppText>
      </AppCard>
    );
  }

  return (
    <View style={styles.container}>
      <AppText variant="title">{matchDay?.name ?? 'Spieltag'}</AppText>

      <AppSection title="Spiele">
        {summary.games.length === 0 ? (
          <EmptyState
            title="Keine Spiele"
            message="Dieser abgeschlossene Spieltag enthält keine Spiele."
          />
        ) : (
          <FlatList
            data={summary.games}
            keyExtractor={(game) => game.id}
            renderItem={renderGame}
            contentContainerStyle={styles.list}
          />
        )}
      </AppSection>

      <AppSection title="Finale Salden">
        <FlatList
          data={summary.balances}
          keyExtractor={(balance) => balance.playerId}
          renderItem={renderBalance}
          contentContainerStyle={styles.compactList}
        />
      </AppSection>

      <AppSection title="Finale Auszahlungen">
        {summary.settlements.length === 0 ? (
          <EmptyState
            title="Keine Auszahlungen"
            message="Dieser Spieltag ist bereits ausgeglichen."
          />
        ) : (
          <FlatList
            data={summary.settlements}
            keyExtractor={(settlement) =>
              `${settlement.fromPlayerId}-${settlement.toPlayerId}-${settlement.amount}`
            }
            renderItem={renderSettlement}
            contentContainerStyle={styles.compactList}
          />
        )}
      </AppSection>

      <AppSection title="Statistik">
        <FlatList
          data={summary.playerStats}
          keyExtractor={(stats) => stats.playerId}
          renderItem={renderPlayerStats}
          contentContainerStyle={styles.list}
        />
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
  list: {
    gap: theme.spacing.md,
  },
  compactList: {
    gap: theme.spacing.sm,
  },
  card: {
    gap: theme.spacing.sm,
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
    fontWeight: '700',
  },
  positiveAmount: {
    color: theme.colors.positive,
  },
  negativeAmount: {
    color: theme.colors.negative,
  },
  neutralAmount: {
    color: theme.colors.textMuted,
  },
});
