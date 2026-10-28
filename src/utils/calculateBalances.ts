import type { Balance } from '../models/Balance';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import { calculateRoundBalances, roundWinnerIds } from './accounting';

export function calculateBalances(players: Player[], games: Game[]): Balance[] {
  // Historical debts remain attributable even if the separate directory is damaged.
  const participants = new Map(players.map((player) => [player.id, player]));
  for (const game of games) {
    for (const id of [...roundWinnerIds(game), ...game.loserIds]) {
      if (!participants.has(id)) {
        participants.set(id, {
          id,
          name:
            game.participantNames?.[id] ?? `Name unbekannt (${id.slice(0, 8)})`,
        });
      }
    }
  }
  return calculateRoundBalances([...participants.values()], games);
}
