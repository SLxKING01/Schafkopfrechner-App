export type MainTabParamList = {
  Games: undefined;
  CreateGame: { gameId?: string } | undefined;
  Statistics: undefined;
  History: undefined;
  Players: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  CloseMatchDay: undefined;
  MatchDayDetails: { matchDayId: string };
};
