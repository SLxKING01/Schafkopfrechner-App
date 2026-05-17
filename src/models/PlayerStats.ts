export type PlayerStats = {
  playerId: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalAmount: number;
  favoriteGameTypeId?: string;
};
