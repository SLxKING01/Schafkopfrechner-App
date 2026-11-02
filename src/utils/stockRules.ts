import type { GameRound, GameTable, TableSettings } from '../types/game';
import { getStockBalanceCents, roundWinnerIds } from './accounting';

export function stockMode(settings: TableSettings) {
  return settings.games.stock.enabled
    ? 'stock'
    : settings.games.ramsch.enabled
      ? 'ramsch'
      : 'off';
}

export function exclusiveStockMode(settings: TableSettings) {
  return !(settings.games.stock.enabled && settings.games.ramsch.enabled);
}

export const stockConflictMessage =
  'Die Korrektur würde bei einem späteren Regelwechsel Geld im Stock lassen. Bitte zuerst den Regelwechsel zurücknehmen oder die betroffenen Spiele korrigieren.';

/** Replay versioned movements; legacy manual stock entries retain their meaning.
 * Settings snapshots also mark the boundary of changes made between games. */
export function replayStockRules(
  rounds: GameRound[],
  table?: GameTable | null,
) {
  const result: GameRound[] = [];
  let previousMode: ReturnType<typeof stockMode> | undefined;
  let pot = 0;
  for (const original of rounds) {
    const mode = stockMode(original.settingsSnapshot);
    if (previousMode !== undefined && mode !== previousMode && pot > 0)
      throw new Error(stockConflictMessage);
    previousMode = mode;
    let round = original;
    if (original.stockRulesVersion === 1) {
      if (!exclusiveStockMode(original.settingsSnapshot))
        throw new Error(
          'Stock und Ramsch können nicht gleichzeitig aktiv sein.',
        );
      if (original.gameType === 'ramsch' && mode !== 'ramsch')
        throw new Error('Ramsch ist an diesem Tisch nicht aktiv.');
      round = { ...original };
      if (['rufspiel', 'sauspiel'].includes(round.gameType)) {
        if (mode === 'stock') {
          const winners = roundWinnerIds(round);
          if (
            !round.declarerId ||
            !round.partnerId ||
            round.declarerId === round.partnerId ||
            winners.length !== 2 ||
            round.loserIds.length !== 2 ||
            ![...winners, ...round.loserIds].includes(round.declarerId) ||
            winners.includes(round.declarerId) !==
              winners.includes(round.partnerId) ||
            ![...winners, ...round.loserIds].includes(round.partnerId)
          )
            throw new Error('Bitte Ansager und Partner eindeutig auswählen.');
          round.stockAction =
            pot > 0
              ? winners.includes(round.declarerId)
                ? 'payout'
                : 'double'
              : undefined;
        } else round.stockAction = undefined;
      } else if (
        round.stockAction === 'payout' ||
        round.stockAction === 'double'
      ) {
        throw new Error('Nur Sauspiele verändern den Stock beim Ausspielen.');
      }
      if (round.stockAction === 'deposit' && mode !== 'stock')
        throw new Error('Stock ist an diesem Tisch nicht aktiv.');
      round.stockBeforeCents = pot;
    }
    result.push(round);
    pot = getStockBalanceCents([round], pot);
    if (round.stockRulesVersion === 1) round.stockAfterCents = pot;
  }
  if (
    table &&
    previousMode !== undefined &&
    stockMode(table.settings) !== previousMode &&
    pot > 0
  )
    throw new Error(stockConflictMessage);
  return result;
}
