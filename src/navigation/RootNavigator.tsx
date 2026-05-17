import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { useStoresHydrated } from '../hooks/useStoresHydrated';
import { CloseMatchDayScreen } from '../screens/CloseMatchDayScreen';
import { MatchDayDetailsScreen } from '../screens/MatchDayDetailsScreen';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isHydrated = useStoresHydrated();

  if (!isHydrated) {
    return <AppLoadingScreen />;
  }

  return (
    <AppErrorBoundary>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CloseMatchDay"
            component={CloseMatchDayScreen}
            options={{ title: 'Spieltag abschliessen' }}
          />
          <Stack.Screen
            name="MatchDayDetails"
            component={MatchDayDetailsScreen}
            options={{ title: 'Spieltag' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppErrorBoundary>
  );
}
