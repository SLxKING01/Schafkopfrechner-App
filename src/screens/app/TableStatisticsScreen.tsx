import { ScrollView, StyleSheet } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import {
  StatAction,
  StatHeading,
  StatNote,
  TableStatisticsPanel,
} from '../../components/statistics/StatisticsPanels';
import { useGameOverview } from '../../hooks/useGameOverview';
import { useOverviewNavigation } from '../../hooks/useOverviewNavigation';
import type { AppStackScreenProps } from '../../navigation/types';
import { authSpacing } from '../../theme';

export function TableStatisticsScreen({
  navigation,
  route,
}: AppStackScreenProps<'TableStatistics'>) {
  const { statisticsTables } = useGameOverview();
  const { openStatisticsRound } = useOverviewNavigation();
  const table = statisticsTables.find((t) => t.id === route.params.tableKey);
  return (
    <AuthBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <StatAction onPress={() => navigation.goBack()}>‹ Zurück</StatAction>
        <StatHeading>Tischstatistik</StatHeading>
        {table ? (
          <TableStatisticsPanel
            key={table.id}
            table={table}
            onOpen={(r) => openStatisticsRound(table, r)}
          />
        ) : (
          <StatNote>Dieser Tisch ist nicht mehr verfügbar.</StatNote>
        )}
      </ScrollView>
    </AuthBackground>
  );
}
const styles = StyleSheet.create({
  content: {
    padding: authSpacing.lgPlus,
    paddingBottom: authSpacing.xxxl,
    gap: authSpacing.md,
  },
});
