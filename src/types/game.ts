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
export type CardSuit = 'eichel' | 'gras' | 'herz' | 'schellen';

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
  gameRules?: Partial<Record<TableGameTypeId, GameRuleOptions>>;
  games: Record<TableGameTypeId, TableSettingEntry>;
  bonusRules: Record<BonusRuleId, TableSettingEntry>;
};

export type GameRuleOptions = {
  bonuses: Record<BonusRuleId, boolean>;
  laufendeMin: number;
  laufendeMax: number;
  ramschJungfrau: boolean;
  ramschDurchmarsch: boolean;
};
export type StockAction =
  | 'deposit'
  | 'payout'
  | 'refund'
  | 'carryOut'
  | 'carryIn';

export type GameTable = {
  id: string;
  hashCode: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  isFavorite?: boolean;
  sortOrder?: number;
  settings: TableSettings;
  dealerId?: string;
  turboRamschEnabled?: boolean;
  placedLegerPlayerIds?: string[];
};

export type GameRound = {
  suit?: CardSuit;
  id: string;
  tableId: string;
  winnerId: string;
  winnerIds?: string[];
  loserIds: string[];
  amount: number;
  gameType: GameType;
  settingsSnapshot: TableSettings;
  createdAt: string;
  tariffOptions?: RoundTariffOptions;
  stockAction?: StockAction;
  stockCompletesDeal?: boolean;
  declarerId?: string;
  partnerId?: string;
  roundContext?: RoundContext;
  updatedAt?: string;
};

export type RoundTariffOptions = {
  jungfrauen?: number;
  durchmarsch?: boolean;
  laufende: number;
  schneider: boolean;
  schwarz: boolean;
  stoss: number;
  legerCount: number;
  turboRamsch: boolean;
};

export type RoundContext = {
  completesDeal?: boolean;
  dealerIdBefore: string;
  legerPlayerIds: string[];
  turboRamsch: boolean;
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

export type ArchivedTable = {
  currentTable: GameTable;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  archivedAt: string;
};

export type CreateTablePayload = {
  existingHashCodes?: string[];
  name: string;
  players: Player[];
  settings?: TableSettings;
};

export type CreateRoundPayload = {
  clearPartyMetadata?: boolean;
  legerPlayerIds?: string[];
  suit?: CardSuit;
  stockAction?: StockAction;
  stockCompletesDeal?: boolean;
  declarerId?: string;
  partnerId?: string;
  winnerId: string;
  winnerIds?: string[];
  loserIds: string[];
  amount: number;
  gameType: GameType;
  settingsSnapshot?: TableSettings;
  tariffOptions?: RoundTariffOptions;
};

export type ArchivedGameDay = {
  table: GameTable;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  completedAt: string | null;
};
