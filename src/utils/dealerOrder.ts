import type { GameTable, Player } from '../types/game';

export const activePlayers = (players: Player[]) =>
  players.filter((p) => !p.isPaused);
export function getCurrentDealerId(
  table: GameTable | null,
  players: Player[],
  roundCount: number,
) {
  const active = activePlayers(players);
  if (!active.length) return null;
  if (table?.dealerId) {
    const index = players.findIndex((p) => p.id === table.dealerId);
    if (index >= 0) {
      for (let offset = 0; offset < players.length; offset++) {
        const p = players[(index + offset) % players.length];
        if (!p.isPaused) return p.id;
      }
    }
  }
  return active[roundCount % active.length].id;
}
export function getNextDealerId(
  table: GameTable | null,
  players: Player[],
  roundCount: number,
) {
  const current = getCurrentDealerId(table, players, roundCount);
  if (!current) return null;
  const index = players.findIndex((p) => p.id === current);
  for (let offset = 1; offset <= players.length; offset++) {
    const p = players[(index + offset) % players.length];
    if (!p.isPaused) return p.id;
  }
  return null;
}
export function roundPlayers(
  table: GameTable | null,
  players: Player[],
  roundCount: number,
) {
  const active = activePlayers(players);
  if (active.length < 4 || active.length > 5) return [];
  const dealer = getCurrentDealerId(table, players, roundCount);
  return active.length === 5 ? active.filter((p) => p.id !== dealer) : active;
}
/** Detect changes even when the resulting four IDs happen to match. */
export function participationRevision(
  table: GameTable | null,
  players: Player[],
  roundCount: number,
) {
  return JSON.stringify([
    table?.id,
    getCurrentDealerId(table, players, roundCount),
    players.map((p) => [p.id, !!p.isPaused]),
    roundCount,
  ]);
}
