import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AppStackParamList } from '../navigation/types';
import type { OverviewTarget } from '../utils/gameOverview';

export function useOverviewNavigation() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  return {
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
