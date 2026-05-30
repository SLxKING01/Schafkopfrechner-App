import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  CloseMatchDay: undefined;
  MatchDayDetails: { matchDayId: string };
};

export type AppStackParamList = {
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  CreateTable: undefined;
  EditTable: undefined;
  ActiveGame: undefined;
  Settlement: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Statistics: undefined;
  GameLobby: undefined;
  Profile: undefined;
};

export type MainTabParamList = {
  Games: undefined;
  CreateGame: { gameId?: string } | undefined;
  Statistics: undefined;
  History: undefined;
  Players: undefined;
};

export type RootStackParamList = {
  AuthStack: undefined;
  AppStack: undefined;
  MainTabs: undefined;
  CloseMatchDay: undefined;
  MatchDayDetails: { matchDayId: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type AppStackScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;
