import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AppStackParamList } from '../navigation/types';
import type { OverviewTarget } from '../utils/gameOverview';
import type { StatisticsRound, StatisticsTable } from '../utils/statistics';

export function useOverviewNavigation() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  return {
    openProfile: () => navigation.navigate('AppTabs', { screen: 'Profile' }),
    openTableStatistics: (tableKey: string) =>
      navigation.navigate('TableStatistics', { tableKey }),
    openStatisticsRound: (table: StatisticsTable, round: StatisticsRound) => {
      if (table.target.kind === 'active')
        navigation.navigate('ActiveGame', { roundId: round.id });
      else if (table.target.kind === 'archive')
        navigation.navigate('Settlement', {
          tableId: table.target.tableId,
          roundId: round.id,
        });
      else
        navigation.navigate('MatchDayDetails', {
          matchDayId: table.target.matchDayId,
        });
    },
    openTarget: (target: OverviewTarget) => {
      if (target.kind === 'active') navigation.navigate('ActiveGame');
      else if (target.kind === 'archive')
        navigation.navigate('Settlement', { tableId: target.tableId });
      else
        navigation.navigate('MatchDayDetails', {
          matchDayId: target.matchDayId,
        });
    },
    openTables: () => navigation.navigate('AppTabs', { screen: 'GameLobby' }),
    openStatistics: () =>
      navigation.navigate('AppTabs', { screen: 'Statistics' }),
    createTable: () => navigation.navigate('CreateTable'),
  };
}
