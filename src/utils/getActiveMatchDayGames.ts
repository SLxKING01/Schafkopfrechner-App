import type { Game } from '../models/Game';

export function getActiveMatchDayGames(
  games: Game[],
  activeMatchDayId: string | null,
): Game[] {
  if (!activeMatchDayId) {
    return [];
  }

  return games.filter(
    (game) => !game.matchDayId || game.matchDayId === activeMatchDayId,
  );
}
