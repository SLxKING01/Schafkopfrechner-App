export type Player = {
  id: string;
  name: string;
  isLocal: boolean;
  userId?: string;
};

export type GameType = 'sauspiel' | 'solo' | 'wenz' | 'ramsch' | 'custom';

export type GameTable = {
  id: string;
  hashCode: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  isFavorite?: boolean;
  sortOrder?: number;
};

export type GameRound = {
  id: string;
  tableId: string;
  winnerId: string;
  loserIds: string[];
  amount: number;
  gameType: GameType;
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
};

export type CreateRoundPayload = {
  winnerId: string;
  loserIds: string[];
  amount: number;
  gameType: GameType;
};
