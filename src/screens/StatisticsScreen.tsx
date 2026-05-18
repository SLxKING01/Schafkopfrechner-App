import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { AppCard } from '../components/ui/AppCard';
import { AppSection } from '../components/ui/AppSection';
import { AppText } from '../components/ui/AppText';
import { getGameTypeById } from '../constants/gameTypes';
import { theme } from '../constants/theme';
import type { PlayerStats } from '../models/PlayerStats';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import { calculatePlayerStats } from '../utils/calculatePlayerStats';
import { getActiveMatchDayGames } from '../utils/getActiveMatchDayGames';

export function StatisticsScreen() {
  const games = useGameStore((state) => state.games);
  const players = usePlayerStore((state) => state.players);
  const matchDays = useMatchDayStore((state) => state.matchDays);
  const activeMatchDayId = useMatchDayStore((state) => state.activeMatchDayId);
  const activeMatchDay = matchDays.find(
    (matchDay) => matchDay.id === activeMatchDayId,
  );
  const activeGames = useMemo(
    () => getActiveMatchDayGames(games, activeMatchDayId),
    [games, activeMatchDayId],
  );
  const playerStats = useMemo(
    () => calculatePlayerStats(players, activeGames),
    [players, activeGames],
  );

  function getPlayerName(id: string) {
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

  function renderPlayerStats({ item }: { item: PlayerStats }) {
    const favoriteGameTypeName = item.favoriteGameTypeId
      ? getGameTypeById(item.favoriteGameTypeId).name
      : 'Keine Spiele';

    return (
      <AppCard style={styles.card}>
        <View style={styles.header}>
          <AppText variant="subtitle" style={styles.playerName}>
            {getPlayerName(item.playerId)}
          </AppText>
          <AppText style={[styles.amount, getAmountStyle(item.totalAmount)]}>
            {formatAmount(item.totalAmount)}
          </AppText>
        </View>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <AppText variant="caption">Winrate</AppText>
            <AppText>{formatWinRate(item.winRate)}</AppText>
          </View>
          <View style={styles.metaItem}>
            <AppText variant="caption">Bilanz</AppText>
            <AppText>
              {item.wins} Siege / {item.losses} Niederlagen
            </AppText>
          </View>
          <View style={styles.metaItem}>
            <AppText variant="caption">Spiele</AppText>
            <AppText>{item.totalGames}</AppText>
          </View>
          <View style={styles.metaItem}>
            <AppText variant="caption">Lieblingsspieltyp</AppText>
            <AppText>{favoriteGameTypeName}</AppText>
          </View>
        </View>
      </AppCard>
    );
  }

  return (
    <View style={styles.container}>
      <AppText variant="title">Statistik</AppText>
      <AppCard style={styles.matchDayCard}>
        <AppText variant="caption">Aktiver Spieltag</AppText>
        <AppText variant="subtitle">
          {activeMatchDay?.name ?? 'Kein Spieltag'}
        </AppText>
      </AppCard>

      <AppSection title="Spielerstatistiken">
        {players.length === 0 ? (
          <EmptyState
            title="Noch keine Statistiken"
            message="Lege Spieler an und erfasse Spiele, damit Statistiken entstehen."
          />
        ) : activeGames.length === 0 ? (
          <EmptyState
            title="Noch keine Spiele"
            message="Statistiken für diesen Spieltag erscheinen nach dem ersten Spiel."
          />
        ) : (
          <FlatList
            data={playerStats}
            keyExtractor={(stats) => stats.playerId}
            renderItem={renderPlayerStats}
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
  list: {
    gap: theme.spacing.md,
  },
  card: {
    gap: theme.spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  playerName: {
    flex: 1,
  },
  amount: {
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
  metaGrid: {
    gap: theme.spacing.sm,
  },
  metaItem: {
    gap: theme.spacing.xs,
  },
});
