import type { GameRound, TableSettings } from '../types/game';
import {
  getStockBalanceCents,
  roundWinnerIds,
  toSafeCents,
} from './accounting';
import { calculatePartyAmount, calculateRoundTariff } from './roundTariff';

// Reprice recorded facts without changing which games or bonuses were played.
export function repriceRounds(
  rounds: GameRound[],
  tariffs: TableSettings,
): GameRound[] {
  const result: GameRound[] = [];
  for (const round of rounds) {
    const settings: TableSettings = {
      ...round.settingsSnapshot,
      games: { ...round.settingsSnapshot.games },
      bonusRules: { ...round.settingsSnapshot.bonusRules },
    };
    for (const id of Object.keys(
      settings.games,
    ) as (keyof TableSettings['games'])[]) {
      settings.games[id] = {
        ...settings.games[id],
        value: tariffs.games[id].value,
        mode: tariffs.games[id].mode,
      };
    }
    for (const id of Object.keys(
      settings.bonusRules,
    ) as (keyof TableSettings['bonusRules'])[]) {
      settings.bonusRules[id] = {
        ...settings.bonusRules[id],
        value: tariffs.bonusRules[id].value,
        mode: tariffs.bonusRules[id].mode,
      };
    }
    let amount = round.amount;
    if (round.stockAction === 'deposit') {
      amount =
        (toSafeCents(settings.games.stock.value)! * round.loserIds.length) /
        100;
    } else if (
      round.stockAction === 'refund' ||
      round.stockAction === 'carryOut'
    ) {
      amount = getStockBalanceCents(result) / 100;
    } else if (round.tariffOptions) {
      const tariff = calculateRoundTariff(
        settings,
        round.gameType,
        round.tariffOptions,
      );
      amount =
        calculatePartyAmount(
          tariff.totalCents,
          round.gameType,
          roundWinnerIds(round).length,
          round.loserIds.length,
          settings.gameRules ||
            round.tariffOptions.durchmarsch !== undefined ||
            round.tariffOptions.jungfrauen !== undefined
            ? round.tariffOptions
            : undefined,
        ).totalCents / 100;
    } else {
      // Manual amounts and stock carried from another table have no tariff to recalculate.
      result.push(round);
      continue;
    }
    result.push({
      ...round,
      amount,
      settingsSnapshot: settings,
      updatedAt: new Date().toISOString(),
    });
  }
  return result;
}
