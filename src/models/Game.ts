import type { GameOptions } from './GameOptions';

export type Game = {
  id: string;
  winnerId: string;
  loserIds: string[];
  amount: number;
  createdAt: string;
  gameTypeId?: string;
  options?: GameOptions;
  matchDayId?: string;
};

export type CreateGameInput = {
  winnerId: string;
  loserIds: string[];
  amount: number;
  gameTypeId: string;
  options: GameOptions;
  matchDayId?: string;
};
