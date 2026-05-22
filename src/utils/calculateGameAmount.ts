import { getGameTypeById } from '../constants/gameTypes';
import type { GameOptions } from '../models/GameOptions';
import { calculateBaseAmount } from './calculateBaseAmount';
import { normalizeGameOptions } from './formatGameOptions';

const LAUFENDE_AMOUNT = 10;
const SCHNEIDER_AMOUNT = 10;
const SCHWARZ_AMOUNT = 20;

export function calculateGameAmount(
  gameTypeId?: string,
  options?: Partial<GameOptions>,
): number {
  const normalizedOptions = normalizeGameOptions(options);

  return (
    calculateBaseAmount(gameTypeId) +
    normalizedOptions.laufende * LAUFENDE_AMOUNT +
    (normalizedOptions.schneider ? SCHNEIDER_AMOUNT : 0) +
    (normalizedOptions.schwarz ? SCHWARZ_AMOUNT : 0)
  );
}

export function formatGameAmountSummary(
  gameTypeId?: string,
  options?: Partial<GameOptions>,
): string {
  const gameType = getGameTypeById(gameTypeId);
  const normalizedOptions = normalizeGameOptions(options);
  const parts = [gameType.name];

  if (normalizedOptions.laufende > 0) {
    parts.push(`${normalizedOptions.laufende} Laufende`);
  }

  if (normalizedOptions.schneider) {
    parts.push('Schneider');
  }

  if (normalizedOptions.schwarz) {
    parts.push('Schwarz');
  }

  return parts.join(' • ');
}
