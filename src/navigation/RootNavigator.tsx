import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { ProfileSetupPrompt } from '../components/profile/ProfileSetupPrompt';
import { useCloudSync } from '../hooks/useCloudSync';
import { useFriendsSession } from '../hooks/useFriendsSession';
import { useProfileSession } from '../hooks/useOwnProfile';
import { useRestoreGame } from '../hooks/useRestoreGame';
import { useStoresHydrated } from '../hooks/useStoresHydrated';
import { ActiveGameScreen } from '../screens/app/ActiveGameScreen';
import { CreateTableScreen } from '../screens/app/CreateTableScreen';
import { EditProfileScreen } from '../screens/app/EditProfileScreen';
import { EditTableScreen } from '../screens/app/EditTableScreen';
import { FriendsScreen } from '../screens/app/FriendsScreen';
import { SettlementScreen } from '../screens/app/SettlementScreen';
import { TableArchiveScreen } from '../screens/app/TableArchiveScreen';
import { TableInvitationsScreen } from '../screens/app/TableInvitationsScreen';
import { TableStatisticsScreen } from '../screens/app/TableStatisticsScreen';
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
  return (
    <AppStack.Navigator
      initialRouteName="AppTabs"
      screenOptions={sharedStackScreenOptions}
    >
      <AppStack.Screen
        name="AppTabs"
        component={AppTabs}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="TableInvitations"
        component={TableInvitationsScreen}
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
        name="TableStatistics"
        component={TableStatisticsScreen}
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
  useFriendsSession();
  useProfileSession();
  const sharedCacheOwner = useGameStore(
    (state) => state.currentTable?.shared?.userId,
  );
  const userId = useAuthStore((state) => state.user?.id);
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
    (isAuthenticated && !!sharedCacheOwner && sharedCacheOwner !== userId) ||
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
      {isAuthenticated ? <ProfileSetupPrompt key={userId} /> : null}
    </AppErrorBoundary>
  );
}
