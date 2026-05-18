import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { useRealtimeTable } from '../hooks/useRealtimeTable';
import { useRestoreGame } from '../hooks/useRestoreGame';
import { useStoresHydrated } from '../hooks/useStoresHydrated';
import { ActiveGameScreen } from '../screens/app/ActiveGameScreen';
import { CreateTableScreen } from '../screens/app/CreateTableScreen';
import { SettlementScreen } from '../screens/app/SettlementScreen';
import { CloseMatchDayScreen } from '../screens/CloseMatchDayScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MatchDayDetailsScreen } from '../screens/MatchDayDetailsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { AppTabs } from './AppTabs';
import { TabNavigator } from './TabNavigator';
import type {
  AppStackParamList,
  AuthStackParamList,
  RootStackParamList,
} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator initialRouteName="Onboarding">
      <AuthStack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="CloseMatchDay"
        component={CloseMatchDayScreen}
        options={{ title: 'Spieltag abschliessen' }}
      />
      <AuthStack.Screen
        name="MatchDayDetails"
        component={MatchDayDetailsScreen}
        options={{ title: 'Spieltag' }}
      />
    </AuthStack.Navigator>
  );
}

function AppStackNavigator() {
  const activeGame = useGameStore((state) => state.activeGame);
  const currentTable = useGameStore((state) => state.currentTable);
  useRealtimeTable(currentTable?.id);

  return (
    <AppStack.Navigator
      initialRouteName={activeGame ? 'ActiveGame' : 'AppTabs'}
    >
      <AppStack.Screen
        name="AppTabs"
        component={AppTabs}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="CreateTable"
        component={CreateTableScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="ActiveGame"
        component={ActiveGameScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="Settlement"
        component={SettlementScreen}
        options={{ headerShown: false }}
      />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const storesHydrated = useStoresHydrated();
  const gameRestore = useRestoreGame();
  const authInitialized = useAuthStore((state) => state.initialized);
  const authLoading = useAuthStore((state) => state.loading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let isMounted = true;

    void initializeAuth().then((unsubscribe) => {
      if (isMounted) {
        cleanup = unsubscribe;
        return;
      }

      unsubscribe();
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [initializeAuth]);

  if (
    !storesHydrated ||
    !gameRestore.restored ||
    !authInitialized ||
    authLoading
  ) {
    return <AppLoadingScreen />;
  }

  return (
    <AppErrorBoundary>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name={isAuthenticated ? 'AppStack' : 'AuthStack'}
            component={isAuthenticated ? AppStackNavigator : AuthStackNavigator}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppErrorBoundary>
  );
}
