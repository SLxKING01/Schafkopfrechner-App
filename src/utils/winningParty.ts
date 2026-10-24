export type PartyResult = {
  winnerId: string;
  winnerIds?: string[];
  loserIds: string[];
  amount: number;
};

export function winningIds(
  result: Pick<PartyResult, 'winnerId' | 'winnerIds'>,
): string[] {
  return result.winnerIds?.length ? result.winnerIds : [result.winnerId];
}

export function partyBalances(
  players: { id: string }[],
  results: PartyResult[],
) {
  const cents = new Map(players.map((player) => [player.id, 0]));
  for (const result of results) {
    const winners = winningIds(result);
    const losers = result.loserIds;
    const total = Math.round(result.amount * 100);
    if (
      !Number.isSafeInteger(total) ||
      total <= 0 ||
      !winners.length ||
      !losers.length
    )
      continue;
    for (const [ids, sign] of [
      [winners, 1],
      [losers, -1],
    ] as const) {
      ids.forEach((id, index) => {
        const share =
          Math.floor(total / ids.length) + (index < total % ids.length ? 1 : 0);
        cents.set(id, (cents.get(id) ?? 0) + sign * share);
      });
    }
  }
  return [...cents].map(([playerId, amount]) => ({
    playerId,
    amount: amount / 100,
  }));
}

export function validParties(
  result: PartyResult,
  players: { id: string }[],
  type?: string,
) {
  const winners = winningIds(result);
  const ids = [...winners, ...result.loserIds];
  return (
    winners.length > 0 &&
    result.loserIds.length > 0 &&
    winners[0] === result.winnerId &&
    new Set(ids).size === ids.length &&
    ids.every((id) => players.some((player) => player.id === id)) &&
    Number.isSafeInteger(Math.round(result.amount * 100)) &&
    Math.round(result.amount * 100) > 0 &&
    (!['rufspiel', 'sauspiel'].includes(type ?? '') ||
      (winners.length === 2 && result.loserIds.length === 2))
  );
}
