export type Player = {
  isPaused?: boolean;
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
  stockStakeConfigured?: boolean;
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
  | 'double'
  | 'refund'
  | 'carryOut'
  | 'carryIn';

export type InterimPayment = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
  createdAt: string;
  voidedAt?: string;
};

export type GameTable = {
  shared?: {
    userId: string;
    code?: string;
    ownerId?: string;
    version: number;
    baseline: string;
    updatedAt: string;
  };
  roundHistory?: RoundHistoryEvent[];
  interimPayments?: InterimPayment[];
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
  stockRulesVersion?: 1;
  stockBeforeCents?: number;
  stockAfterCents?: number;
  participantIds?: string[];
  seatOrderIds?: string[];
  customAmounts?: PlayerBalance[];
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
  declarerWon?: boolean;
  roundContext?: RoundContext;
  updatedAt?: string;
};

export type RoundHistoryActor =
  | { kind: 'account'; id: string; name: string }
  | { kind: 'local'; name: string };

export type RoundHistoryEvent = {
  id: string;
  roundId: string;
  sequence: number;
  occurredAt: string;
  action: 'created' | 'updated' | 'deleted' | 'restored';
  actor: RoundHistoryActor;
  players: { id: string; name: string }[];
  before?: GameRound;
  after?: GameRound;
  causeRoundId?: string;
  /** Order before deletion, including legacy rounds without creation events. */
  roundOrderIds?: string[];
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
  declarerWon?: boolean;
  participantIds?: string[];
  participationRevision?: string;
  customAmounts?: PlayerBalance[];
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
