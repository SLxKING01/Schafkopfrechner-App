import {
  CommonActions,
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform } from 'react-native';

import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { ProfileSetupPrompt } from '../components/profile/ProfileSetupPrompt';
import { AppDialogHost } from '../components/ui/AppDialog';
import { useCloudSync } from '../hooks/useCloudSync';
import { useFriendsSession } from '../hooks/useFriendsSession';
import { useProfileSession } from '../hooks/useOwnProfile';
import { useRestoreGame } from '../hooks/useRestoreGame';
import { useStoresHydrated } from '../hooks/useStoresHydrated';
import { clearRecoverySession } from '../lib/supabase';
import { ActiveGameScreen } from '../screens/app/ActiveGameScreen';
import { CreateTableScreen } from '../screens/app/CreateTableScreen';
import { EditProfileScreen } from '../screens/app/EditProfileScreen';
import { EditTableScreen } from '../screens/app/EditTableScreen';
import { FriendsScreen } from '../screens/app/FriendsScreen';
import { PayPalMeScreen } from '../screens/app/PayPalMeScreen';
import { PersonalSettlementsScreen } from '../screens/app/PersonalSettlementsScreen';
import { QuickRoundScreen } from '../screens/app/QuickRoundScreen';
import { SettlementScreen } from '../screens/app/SettlementScreen';
import { TableInvitationsScreen } from '../screens/app/TableInvitationsScreen';
import { TableStatisticsScreen } from '../screens/app/TableStatisticsScreen';
import { LegalScreen } from '../screens/LegalScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MatchDayDetailsScreen } from '../screens/MatchDayDetailsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import {
  RequestPasswordScreen,
  ResetPasswordScreen,
} from '../screens/PasswordRecoveryScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { parseRecoveryLink } from '../services/auth/passwordRecovery';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useGuestModeStore } from '../store/guestModeStore';
import { authColors } from '../theme/colors';
import { quickRoundURL } from '../utils/quickRound';
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
  // Guests who chose "Ohne Account spielen" before start directly in the app.
  const guestMode = useGuestModeStore((state) => state.enabled);
  return (
    <AuthStack.Navigator
      initialRouteName={guestMode ? 'MainTabs' : 'Onboarding'}
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
        name="RequestPassword"
        component={RequestPasswordScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Legal"
        component={LegalScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="MainTabs"
        component={AppStackNavigator}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="MatchDayDetails"
        component={MatchDayDetailsScreen}
        options={{ title: 'Spieltag', headerShown: false }}
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
        name="PayPalMe"
        component={PayPalMeScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="RequestPassword"
        component={RequestPasswordScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="Legal"
        component={LegalScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="PersonalSettlements"
        component={PersonalSettlementsScreen}
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
        name="QuickRound"
        component={QuickRoundScreen}
        options={{ title: 'Spiel eintragen', headerShown: false }}
      />
      <AppStack.Screen
        name="EditTable"
        component={EditTableScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="MatchDayDetails"
        component={MatchDayDetailsScreen}
        options={{ title: 'Spieltag', headerShown: false }}
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
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const navigation = useNavigationContainerRef<RootStackParamList>();
  const [navigationReady, setNavigationReady] = useState(false);
  const [quickRoundPending, setQuickRoundPending] = useState(false);
  const [recovery, setRecovery] =
    useState<ReturnType<typeof parseRecoveryLink>>(null);
  const lastRecoveryCode = useRef<string | null>(null);
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
    // After signing in the guest choice no longer applies.
    if (isAuthenticated) useGuestModeStore.getState().setEnabled(false);
  }, [isAuthenticated]);
  const loading =
    !storesHydrated ||
    !gameRestore.restored ||
    !authInitialized ||
    (isAuthenticated && !!sharedCacheOwner && sharedCacheOwner !== userId) ||
    authLoading;

  useEffect(() => {
    let mounted = true;
    const receiveRecovery = (url: string | null | undefined) => {
      if (!mounted || !url) return;
      const callback = parseRecoveryLink(url);
      if (!callback) return;
      if (callback.web) {
        const clean = new URL(window.location.href);
        for (const name of [
          'recovery',
          'code',
          'error',
          'error_code',
          'error_description',
        ])
          clean.searchParams.delete(name);
        clean.hash = '';
        window.history.replaceState(window.history.state, '', clean.href);
      }
      if (callback.code && callback.code === lastRecoveryCode.current) return;
      lastRecoveryCode.current = callback.code;
      setRecovery((previous) => previous ?? callback);
    };
    const subscription = Linking.addEventListener('url', ({ url }) =>
      receiveRecovery(url),
    );
    if (Platform.OS === 'web') receiveRecovery(window.location.href);
    else
      void Linking.getInitialURL()
        .then(receiveRecovery)
        .catch(() => undefined);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  function closeRecovery() {
    clearRecoverySession();
    setRecovery(null);
    if (!isAuthenticated && navigation.isReady())
      navigation.navigate('AuthStack', { screen: 'Login' });
  }

  function requestNewRecoveryLink() {
    clearRecoverySession();
    setRecovery(null);
    if (!navigation.isReady()) return;
    if (isAuthenticated)
      navigation.navigate('AppStack', {
        screen: 'RequestPassword',
        params: { fromAccount: true },
      });
    else navigation.navigate('AuthStack', { screen: 'RequestPassword' });
  }

  useEffect(() => {
    if (Platform.OS !== 'ios' || usesExpoGoIOSStack) return;
    let mounted = true;
    const receive = (url: string | null | undefined) => {
      if (mounted && url === quickRoundURL) setQuickRoundPending(true);
    };
    const subscription = Linking.addEventListener('url', ({ url }) =>
      receive(url),
    );
    void Linking.getInitialURL()
      .then(receive)
      .catch(() => undefined);
    if (requireOptionalNativeModule('ExpoWidgets')) {
      void import('../widgets/QuickRoundWidget')
        .then(({ default: widget }) => widget.updateSnapshot({}))
        .catch((error: unknown) =>
          console.warn(
            'Sperrbildschirm-Widget konnte nicht initialisiert werden.',
            error,
          ),
        );
    }
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const guestMode = useGuestModeStore((state) => state.enabled);
  useEffect(() => {
    if (
      loading ||
      (!isAuthenticated && !guestMode) ||
      !quickRoundPending ||
      !navigationReady ||
      !navigation.isReady()
    )
      return;
    const route = navigation.getCurrentRoute();
    setQuickRoundPending(false);
    if (route?.name === 'QuickRound') return;
    if (route?.name === 'ActiveGame') {
      navigation.dispatch({
        ...CommonActions.setParams({ quickRound: true }),
        source: route.key,
      });
    } else if (isAuthenticated) {
      navigation.navigate('AppStack', { screen: 'QuickRound', initial: false });
    } else {
      // Guests use the app inside the AuthStack ("MainTabs").
      navigation.navigate('AuthStack', {
        screen: 'MainTabs',
        params: { screen: 'QuickRound', initial: false },
      });
    }
  }, [
    guestMode,
    isAuthenticated,
    loading,
    navigation,
    navigationReady,
    quickRoundPending,
  ]);

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

  if (loading) {
    return <AppLoadingScreen />;
  }

  return (
    <AppErrorBoundary>
      <NavigationContainer
        ref={navigation}
        onReady={() => setNavigationReady(true)}
      >
        <Stack.Navigator screenOptions={rootStackScreenOptions}>
          <Stack.Screen
            name={isAuthenticated ? 'AppStack' : 'AuthStack'}
            component={isAuthenticated ? AppStackNavigator : AuthStackNavigator}
          />
        </Stack.Navigator>
      </NavigationContainer>
      {isAuthenticated && !recovery ? (
        <ProfileSetupPrompt key={userId} />
      ) : null}
      <AppDialogHost />
      {recovery ? (
        <Modal presentationStyle="fullScreen" onRequestClose={() => undefined}>
          <ResetPasswordScreen
            code={recovery.code}
            onClose={closeRecovery}
            onRequestNewLink={requestNewRecoveryLink}
            closeLabel={isAuthenticated ? 'Zurück zur App' : 'Zur Anmeldung'}
          />
        </Modal>
      ) : null}
    </AppErrorBoundary>
  );
}
