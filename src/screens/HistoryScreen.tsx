import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { AppCard } from '../components/ui/AppCard';
import { AppText } from '../components/ui/AppText';
import { theme } from '../constants/theme';
import type { MatchDay } from '../models/MatchDay';
import type { RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import { calculateMatchDaySummary } from '../utils/calculateMatchDaySummary';

type HistoryNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const navigation = useNavigation<HistoryNavigationProp>();
  const games = useGameStore((state) => state.games);
  const players = usePlayerStore((state) => state.players);
  const getClosedMatchDays = useMatchDayStore(
    (state) => state.getClosedMatchDays,
  );
  const closedMatchDays = getClosedMatchDays();

  function getPlayerName(id?: string) {
    return players.find((player) => player.id === id)?.name ?? 'Keine Spiele';
  }

  function formatAmount(amount?: number) {
    return `${(amount ?? 0).toFixed(2).replace('.', ',')} \u20ac`;
  }

  function formatDate(value?: string) {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleDateString('de-DE');
  }

  function renderMatchDay({ item }: { item: MatchDay }) {
    const summary = calculateMatchDaySummary(players, games, item.id);

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          navigation.navigate('MatchDayDetails', { matchDayId: item.id })
        }
      >
        {({ pressed }) => (
          <AppCard style={[styles.card, pressed && styles.pressed]}>
            <View style={styles.header}>
              <View style={styles.titleBox}>
                <AppText variant="subtitle">{item.name}</AppText>
                <AppText variant="caption">
                  {formatDate(item.closedAt ?? item.createdAt)}
                </AppText>
              </View>
              <AppText variant="caption">{summary.games.length} Spiele</AppText>
            </View>
            <View style={styles.winnerRow}>
              <AppText>Gewinner</AppText>
              <AppText style={styles.winnerText}>
                {getPlayerName(summary.winner?.playerId)} -{' '}
                {formatAmount(summary.winner?.amount)}
              </AppText>
            </View>
          </AppCard>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <AppText variant="title">Historie</AppText>
      {closedMatchDays.length === 0 ? (
        <EmptyState
          title="Noch keine Historie"
          message="Schliesse einen Spieltag ab, um ihn hier wiederzufinden."
        />
      ) : (
        <FlatList
          data={closedMatchDays}
          keyExtractor={(matchDay) => matchDay.id}
          renderItem={renderMatchDay}
          contentContainerStyle={styles.list}
        />
      )}
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
  card: {
    gap: theme.spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  titleBox: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  winnerRow: {
    gap: theme.spacing.xs,
  },
  winnerText: {
    color: theme.colors.positive,
    fontWeight: '700',
  },
});
