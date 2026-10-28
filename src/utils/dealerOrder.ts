import type { GameTable, Player } from '../types/game';

export function getCurrentDealerId(
  table: GameTable | null,
  players: Player[],
  roundCount: number,
) {
  if (!players.length) return null;
  if (table?.dealerId && players.some(({ id }) => id === table.dealerId))
    return table.dealerId;
  return players[roundCount % players.length].id;
}

export function getNextDealerId(
  table: GameTable | null,
  players: Player[],
  roundCount: number,
) {
  const currentId = getCurrentDealerId(table, players, roundCount);
  const index = players.findIndex(({ id }) => id === currentId);
  return index >= 0 ? players[(index + 1) % players.length].id : null;
}
