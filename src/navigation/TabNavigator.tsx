import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { CreateGameScreen } from '../screens/CreateGameScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PlayersScreen } from '../screens/PlayersScreen';
import { StatisticsScreen } from '../screens/StatisticsScreen';
import type { MainTabParamList } from './types';

type TabIconName = keyof typeof Ionicons.glyphMap;

const Tab = createBottomTabNavigator<MainTabParamList>();

function getTabIconName(routeName: keyof MainTabParamList): TabIconName {
  switch (routeName) {
    case 'Games':
      return 'list';
    case 'CreateGame':
      return 'add-circle';
    case 'Statistics':
      return 'stats-chart';
    case 'History':
      return 'time';
    case 'Players':
      return 'people';
  }
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#1f6feb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          borderTopColor: '#e5e7eb',
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={getTabIconName(route.name)}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Games"
        component={HomeScreen}
        options={{ title: 'Spiele' }}
      />
      <Tab.Screen
        name="CreateGame"
        component={CreateGameScreen}
        options={{ title: 'Neues Spiel' }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.setParams({ gameId: undefined });
          },
        })}
      />
      <Tab.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{ title: 'Statistik' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Historie' }}
      />
      <Tab.Screen
        name="Players"
        component={PlayersScreen}
        options={{ title: 'Spieler' }}
      />
    </Tab.Navigator>
  );
}
