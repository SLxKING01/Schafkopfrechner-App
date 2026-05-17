import { DEFAULT_GAME_TYPE_ID } from '../constants/gameTypes';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import type { PlayerStats } from '../models/PlayerStats';
import { calculateBalances } from './calculateBalances';

type MutablePlayerStats = {
  playerId: string;
  totalGames: number;
  wins: number;
  losses: number;
  gameTypeCounts: Map<string, number>;
};

function getFavoriteGameTypeId(gameTypeCounts: Map<string, number>) {
  let favoriteGameTypeId: string | undefined;
  let highestCount = 0;

  gameTypeCounts.forEach((count, gameTypeId) => {
    if (count > highestCount) {
      favoriteGameTypeId = gameTypeId;
      highestCount = count;
    }
  });

  return favoriteGameTypeId;
}

export function calculatePlayerStats(
  players: Player[],
  games: Game[],
): PlayerStats[] {
  const statsByPlayerId = new Map<string, MutablePlayerStats>();
  const balancesByPlayerId = new Map(
    calculateBalances(players, games).map((balance) => [
      balance.playerId,
      Math.round(balance.amount * 100),
    ]),
  );

  players.forEach((player) => {
    statsByPlayerId.set(player.id, {
      playerId: player.id,
      totalGames: 0,
      wins: 0,
      losses: 0,
      gameTypeCounts: new Map<string, number>(),
    });
  });

  games.forEach((game) => {
    const participatingPlayerIds = new Set([game.winnerId, ...game.loserIds]);
    const gameTypeId = game.gameTypeId ?? DEFAULT_GAME_TYPE_ID;

    participatingPlayerIds.forEach((playerId) => {
      const playerStats = statsByPlayerId.get(playerId);

      if (!playerStats) {
        return;
      }

      playerStats.totalGames += 1;
      playerStats.gameTypeCounts.set(
        gameTypeId,
        (playerStats.gameTypeCounts.get(gameTypeId) ?? 0) + 1,
      );
    });

    const winnerStats = statsByPlayerId.get(game.winnerId);

    if (winnerStats) {
      winnerStats.wins += 1;
    }

    game.loserIds.forEach((loserId) => {
      const playerStats = statsByPlayerId.get(loserId);

      if (playerStats) {
        playerStats.losses += 1;
      }
    });
  });

  return players.map((player) => {
    const playerStats = statsByPlayerId.get(player.id)!;
    const totalAmountInCents = balancesByPlayerId.get(player.id) ?? 0;

    return {
      playerId: player.id,
      totalGames: playerStats.totalGames,
      wins: playerStats.wins,
      losses: playerStats.losses,
      winRate:
        playerStats.totalGames > 0
          ? (playerStats.wins / playerStats.totalGames) * 100
          : 0,
      totalAmount: totalAmountInCents / 100,
      favoriteGameTypeId: getFavoriteGameTypeId(playerStats.gameTypeCounts),
    };
  });
}
