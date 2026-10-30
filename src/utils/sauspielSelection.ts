/** Complete the other party only when two winners or losers have been selected. */
export function selectSauspielResult(
  playerIds: string[],
  winners: string[],
  losers: string[],
  id: string,
  won: boolean,
) {
  if (!playerIds.includes(id)) return { winners, losers };
  const own = won ? winners : losers,
    other = won ? losers : winners;
  if (own.includes(id)) return { winners, losers };
  let next: string[], opposite: string[];
  if (own.length >= 2) {
    // A third player starts a new pair rather than silently evicting a teammate.
    next = [id];
    opposite = [];
  } else {
    next = [...own, id];
    opposite = other.filter((p) => p !== id);
  }
  if (playerIds.length === 4) {
    if (next.length === 2)
      opposite = playerIds.filter((p) => !next.includes(p));
    else if (opposite.length === 2)
      next = playerIds.filter((p) => !opposite.includes(p));
  }
  return won
    ? { winners: next, losers: opposite }
    : { winners: opposite, losers: next };
}
