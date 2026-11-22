import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { LegalPage } from '../constants/legal';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  RequestPassword: { email?: string } | undefined;
  Register: undefined;
  Legal: { page: LegalPage };
  MainTabs: NavigatorScreenParams<AppStackParamList> | undefined;
  MatchDayDetails: { matchDayId: string };
};

export type AppStackParamList = {
  PersonalSettlements: undefined;
  Legal: { page: LegalPage };
  TableInvitations: { tableId?: string } | undefined;
  Friends: undefined;
  EditProfile: undefined;
  PayPalMe: undefined;
  RequestPassword: { email?: string; fromAccount: true };
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  CreateTable: { templateTableId?: string } | undefined;
  EditTable: undefined;
  MatchDayDetails: { matchDayId: string };
  ActiveGame: { roundId?: string; quickRound?: true | string } | undefined;
  QuickRound: undefined;
  TableStatistics: { tableKey: string };
  Settlement: { tableId: string; roundId?: string } | undefined;
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
  AuthStack: NavigatorScreenParams<AuthStackParamList> | undefined;
  AppStack: NavigatorScreenParams<AppStackParamList> | undefined;
  MainTabs: undefined;
  MatchDayDetails: { matchDayId: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type AppStackScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;
