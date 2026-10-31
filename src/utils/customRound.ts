import type { GameRound, Player, PlayerBalance } from '../types/game';
import { calculateRoundBalances, toSafeCents } from './accounting';

export type CustomRoundDraft = Record<
  string,
  { amount: string; negative: boolean }
>;
export function initialCustomRoundDraft(
  round: GameRound | null,
  players: Player[],
): CustomRoundDraft {
  if (!round || round.gameType !== 'custom') return {};
  const amounts =
    round.customAmounts ?? calculateRoundBalances(players, [round], 'id');
  return Object.fromEntries(
    amounts.map(({ playerId, amount }) => [
      playerId,
      {
        amount: Math.abs(amount).toFixed(2).replace('.', ','),
        negative: amount < 0,
      },
    ]),
  );
}
export function summarizeCustomRound(
  players: Player[],
  draft: CustomRoundDraft = {},
) {
  const amounts: PlayerBalance[] = [];
  let totalCents = 0n;
  let positiveCents = 0n;
  for (const player of players) {
    const entry = draft[player.id] ?? { amount: '0,00', negative: false };
    const value = entry.amount.trim();
    const cents = /^\d+(?:[,.]\d{1,2})?$/.test(value)
      ? toSafeCents(Number(value.replace(',', '.')))
      : null;
    if (cents === null)
      return {
        amounts,
        totalCents: null,
        amountCents: 0,
        error: `Bitte einen gültigen Betrag für ${player.name} eingeben.`,
      };
    const signed = entry.negative ? -cents : cents;
    totalCents += BigInt(signed);
    if (signed > 0) positiveCents += BigInt(signed);
    amounts.push({ playerId: player.id, amount: signed / 100 });
  }
  const amountCents =
    positiveCents <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(positiveCents)
      : 0;
  const error =
    positiveCents > BigInt(Number.MAX_SAFE_INTEGER) ||
    toSafeCents(amountCents / 100) !== amountCents
      ? 'Der Gesamtbetrag ist zu groß.'
      : !amountCents
        ? 'Mindestens einen Plus- und einen Minusbetrag eingeben.'
        : totalCents !== 0n
          ? 'Die Summe muss genau 0,00 € ergeben.'
          : '';
  return { amounts, totalCents, amountCents, error };
}
