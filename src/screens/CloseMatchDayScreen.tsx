import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { AppSection } from '../components/ui/AppSection';
import { AppText } from '../components/ui/AppText';
import { theme } from '../constants/theme';
import type { Balance } from '../models/Balance';
import type { Settlement } from '../models/Settlement';
import type { RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import { calculateBalances } from '../utils/calculateBalances';
import { calculateSettlements } from '../utils/calculateSettlements';
import { getActiveMatchDayGames } from '../utils/getActiveMatchDayGames';

type CloseMatchDayScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CloseMatchDay'
>;

export function CloseMatchDayScreen({ navigation }: CloseMatchDayScreenProps) {
  const games = useGameStore((state) => state.games);
  const players = usePlayerStore((state) => state.players);
  const matchDays = useMatchDayStore((state) => state.matchDays);
  const activeMatchDayId = useMatchDayStore((state) => state.activeMatchDayId);
  const closeMatchDay = useMatchDayStore((state) => state.closeMatchDay);
  const createAndActivateNextMatchDay = useMatchDayStore(
    (state) => state.createAndActivateNextMatchDay,
  );
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

  function getPlayerName(id: string) {
    return players.find((player) => player.id === id)?.name ?? 'Unbekannt';
  }

  function formatAmount(amount: number) {
    return `${amount.toFixed(2).replace('.', ',')} \u20ac`;
  }

  function handleStartNextMatchDay() {
    if (activeMatchDayId) {
      closeMatchDay(activeMatchDayId);
    }

    createAndActivateNextMatchDay();
    navigation.navigate('MainTabs');
  }

  function renderBalance({ item }: { item: Balance }) {
    return (
      <View style={styles.row}>
        <AppText style={styles.rowName}>{getPlayerName(item.playerId)}</AppText>
        <AppText style={styles.rowAmount}>{formatAmount(item.amount)}</AppText>
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

  return (
    <View style={styles.container}>
      <AppCard style={styles.headerCard}>
        <AppText variant="caption">Finaler Spieltag</AppText>
        <AppText variant="title">
          {activeMatchDay?.name ?? 'Kein Spieltag'}
        </AppText>
      </AppCard>

      <AppSection title="Finale Salden">
        <FlatList
          data={balances}
          keyExtractor={(balance) => balance.playerId}
          renderItem={renderBalance}
          contentContainerStyle={styles.list}
        />
      </AppSection>

      <AppSection title="Finale Auszahlungen">
        <FlatList
          data={settlements}
          keyExtractor={(settlement) =>
            `${settlement.fromPlayerId}-${settlement.toPlayerId}-${settlement.amount}`
          }
          renderItem={renderSettlement}
          contentContainerStyle={styles.list}
        />
      </AppSection>

      <AppButton
        title="Neuen Spieltag starten"
        onPress={handleStartNextMatchDay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.xl,
    padding: theme.spacing.xl,
  },
  headerCard: {
    gap: theme.spacing.xs,
  },
  list: {
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
    fontWeight: '600',
  },
});
