import { ScrollView, StyleSheet } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { TableStatisticsView } from '../../components/statistics/TableStatisticsView';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';
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
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('AppTabs', { screen: 'Statistics' });
  };
  return (
    <AuthBackground>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <PageHeader
          onBack={goBack}
          kicker="Tischstatistik"
          title={table?.name ?? 'Tisch'}
        />
        {table ? (
          <TableStatisticsView
            key={table.id}
            table={table}
            onOpen={(r) => openStatisticsRound(table, r)}
          />
        ) : (
          <Notice tone="info">Dieser Tisch ist nicht mehr verfügbar.</Notice>
        )}
      </ScrollView>
    </AuthBackground>
  );
}
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: authSpacing.lgPlus,
    paddingBottom: authSpacing.xxxl,
    gap: authSpacing.md,
  },
});
