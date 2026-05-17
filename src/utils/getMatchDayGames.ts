import type { Game } from '../models/Game';

export function getMatchDayGames(games: Game[], matchDayId: string): Game[] {
  return games.filter((game) => game.matchDayId === matchDayId);
}
