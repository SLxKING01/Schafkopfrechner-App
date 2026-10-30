import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { enableScreens } from 'react-native-screens';

export const usesExpoGoIOSStack =
  Platform.OS === 'ios' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Expo Go owns Info.plist. Avoid native screen controllers entirely in this
// host, including screens nested inside the bottom-tab navigators.
if (usesExpoGoIOSStack) {
  enableScreens(false);
}

// Both stacks implement the stack actions used by this app. Keep the existing
// screen-prop types; do not pass native-only options to the Expo Go fallback.
export const createAppStackNavigator = (
  usesExpoGoIOSStack ? createStackNavigator : createNativeStackNavigator
) as typeof createNativeStackNavigator;
