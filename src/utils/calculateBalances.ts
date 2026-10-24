import type { Balance } from '../models/Balance';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import { partyBalances } from './winningParty';

export function calculateBalances(players: Player[], games: Game[]): Balance[] {
  return partyBalances(players, games);
}
