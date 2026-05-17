import type { Balance } from '../models/Balance';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';

export function calculateBalances(players: Player[], games: Game[]): Balance[] {
  const balancesByPlayerId = new Map<string, number>();

  players.forEach((player) => {
    balancesByPlayerId.set(player.id, 0);
  });

  games.forEach((game) => {
    if (game.loserIds.length === 0) {
      return;
    }

    const amountInCents = Math.round(game.amount * 100);
    const baseLossInCents = Math.trunc(amountInCents / game.loserIds.length);
    const remainderInCents = amountInCents % game.loserIds.length;

    balancesByPlayerId.set(
      game.winnerId,
      (balancesByPlayerId.get(game.winnerId) ?? 0) + amountInCents,
    );

    game.loserIds.forEach((loserId, index) => {
      const lossInCents = baseLossInCents + (index < remainderInCents ? 1 : 0);

      balancesByPlayerId.set(
        loserId,
        (balancesByPlayerId.get(loserId) ?? 0) - lossInCents,
      );
    });
  });

  return players.map((player) => ({
    playerId: player.id,
    amount: (balancesByPlayerId.get(player.id) ?? 0) / 100,
  }));
}
