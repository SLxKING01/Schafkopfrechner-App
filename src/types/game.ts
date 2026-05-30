export type Player = {
  id: string;
  name: string;
  isLocal: boolean;
  userId?: string;
};

export type TableGameTypeId =
  | 'rufspiel'
  | 'solo'
  | 'wenz'
  | 'farbwenz'
  | 'geier'
  | 'farbgeier'
  | 'ramsch'
  | 'bettel'
  | 'hochzeit'
  | 'kreuzbock'
  | 'stock';
export type GameType = TableGameTypeId | 'sauspiel' | 'custom';

export type BonusRuleId =
  | 'laufende'
  | 'schneider'
  | 'schwarz'
  | 'stoss'
  | 'leger';

export type TableSettingEntry = {
  enabled: boolean;
  value: number;
  mode: 'price' | 'multiplier';
};

export type TableSettings = {
  games: Record<TableGameTypeId, TableSettingEntry>;
  bonusRules: Record<BonusRuleId, TableSettingEntry>;
};

export type GameTable = {
  id: string;
  hashCode: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  isFavorite?: boolean;
  sortOrder?: number;
  settings: TableSettings;
};

export type GameRound = {
  id: string;
  tableId: string;
  winnerId: string;
  loserIds: string[];
  amount: number;
  gameType: GameType;
  settingsSnapshot: TableSettings;
  createdAt: string;
};

export type PlayerBalance = {
  playerId: string;
  amount: number;
};

export type Settlement = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
  isPaid: boolean;
};

export type CreateTablePayload = {
  existingHashCodes?: string[];
  name: string;
  players: Player[];
  settings?: TableSettings;
};

export type CreateRoundPayload = {
  winnerId: string;
  loserIds: string[];
  amount: number;
  gameType: GameType;
  settingsSnapshot?: TableSettings;
};
