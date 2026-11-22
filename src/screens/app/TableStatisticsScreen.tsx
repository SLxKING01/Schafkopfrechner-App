import { ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import {
  StatAction,
  StatHeading,
  StatNote,
} from '../../components/statistics/StatisticsPanels';
import { TableStatisticsView } from '../../components/statistics/TableStatisticsView';
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
      <View style={styles.header}>
        <StatAction onPress={() => navigation.goBack()}>‹ Zurück</StatAction>
        <StatHeading>Tischstatistik</StatHeading>
      </View>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {table ? (
          <TableStatisticsView
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
  header: {
    padding: authSpacing.lgPlus,
    gap: authSpacing.md,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: authSpacing.lgPlus,
    paddingBottom: authSpacing.xxxl,
    gap: authSpacing.md,
  },
});
