import type { Balance } from '../models/Balance';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import type { PlayerStats } from '../models/PlayerStats';
import type { Settlement } from '../models/Settlement';
import { calculateBalances } from './calculateBalances';
import { calculatePlayerStats } from './calculatePlayerStats';
import { calculateSettlements } from './calculateSettlements';
import { getMatchDayGames } from './getMatchDayGames';

export type MatchDaySummary = {
  games: Game[];
  balances: Balance[];
  settlements: Settlement[];
  playerStats: PlayerStats[];
  winner?: Balance;
};

function getWinner(balances: Balance[]) {
  return balances.reduce<Balance | undefined>((currentWinner, balance) => {
    if (!currentWinner || balance.amount > currentWinner.amount) {
      return balance;
    }

    return currentWinner;
  }, undefined);
}

export function calculateMatchDaySummary(
  players: Player[],
  games: Game[],
  matchDayId: string,
): MatchDaySummary {
  const matchDayGames = getMatchDayGames(games, matchDayId);
  const balances = calculateBalances(players, matchDayGames);
  const settlements = calculateSettlements(balances);
  const playerStats = calculatePlayerStats(players, matchDayGames);

  return {
    games: matchDayGames,
    balances,
    settlements,
    playerStats,
    winner: getWinner(balances),
  };
}
