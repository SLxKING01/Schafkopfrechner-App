import type { Balance } from '../models/Balance';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import { calculateRoundBalances } from './accounting';

export function calculateBalances(players: Player[], games: Game[]): Balance[] {
  return calculateRoundBalances(players, games);
}
