import type { Game } from '../models/Game';

export function historicalNames(
  players: { id: string; name: string }[],
  games: Game[],
) {
  const names = new Map(players.map((player) => [player.id, player.name]));
  for (const game of games) {
    for (const [id, name] of Object.entries(game.participantNames ?? {})) {
      if (!names.has(id)) names.set(id, name);
    }
  }
  return names;
}
