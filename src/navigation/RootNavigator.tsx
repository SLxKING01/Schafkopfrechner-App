import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { useCloudSync } from '../hooks/useCloudSync';
import { useRestoreGame } from '../hooks/useRestoreGame';
import { useStoresHydrated } from '../hooks/useStoresHydrated';
import { ActiveGameScreen } from '../screens/app/ActiveGameScreen';
import { CreateTableScreen } from '../screens/app/CreateTableScreen';
import { EditTableScreen } from '../screens/app/EditTableScreen';
import { SettlementScreen } from '../screens/app/SettlementScreen';
import { TableArchiveScreen } from '../screens/app/TableArchiveScreen';
import { CloseMatchDayScreen } from '../screens/CloseMatchDayScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MatchDayDetailsScreen } from '../screens/MatchDayDetailsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { authColors } from '../theme/colors';
import { AppTabs } from './AppTabs';
import {
  createAppStackNavigator,
  usesExpoGoIOSStack,
} from './createAppStackNavigator';
import type {
  AppStackParamList,
  AuthStackParamList,
  RootStackParamList,
} from './types';

const Stack = createAppStackNavigator<RootStackParamList>();
const AuthStack = createAppStackNavigator<AuthStackParamList>();
const AppStack = createAppStackNavigator<AppStackParamList>();

// Leave native-stack statusBar* options unset, including explicit animation defaults.
// Expo Go cannot change its controller-based Info.plist setting; App.tsx owns the
// status bar through expo-status-bar instead.
const sharedStackScreenOptions: NativeStackNavigationOptions = {
  ...(usesExpoGoIOSStack
    ? { cardStyle: { backgroundColor: authColors.background } }
    : {}),
  contentStyle: {
    backgroundColor: authColors.background,
  },
  headerStyle: {
    backgroundColor: authColors.background,
  },
  headerTintColor: authColors.textPrimary,
};

const rootStackScreenOptions: NativeStackNavigationOptions = {
  ...sharedStackScreenOptions,
  headerShown: false,
};

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Onboarding"
      screenOptions={sharedStackScreenOptions}
    >
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
        component={AppStackNavigator}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="CloseMatchDay"
        component={CloseMatchDayScreen}
        options={{ title: 'Spieltag abschließen' }}
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

  return (
    <AppStack.Navigator
      initialRouteName={activeGame ? 'ActiveGame' : 'AppTabs'}
      screenOptions={sharedStackScreenOptions}
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
        name="EditTable"
        component={EditTableScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="MatchDayDetails"
        component={MatchDayDetailsScreen}
        options={{ title: 'Spieltag' }}
      />
      <AppStack.Screen
        name="Settlement"
        component={SettlementScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="TableArchive"
        component={TableArchiveScreen}
        options={{ headerShown: false }}
      />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const storesHydrated = useStoresHydrated();
  const gameRestore = useRestoreGame(storesHydrated);
  useCloudSync(storesHydrated && gameRestore.restored);
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
        <Stack.Navigator screenOptions={rootStackScreenOptions}>
          <Stack.Screen
            name={isAuthenticated ? 'AppStack' : 'AuthStack'}
            component={isAuthenticated ? AppStackNavigator : AuthStackNavigator}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppErrorBoundary>
  );
}
