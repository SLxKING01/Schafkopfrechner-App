import { getGameTypeById } from '../constants/gameTypes';

export function calculateBaseAmount(gameTypeId?: string): number {
  return getGameTypeById(gameTypeId).baseAmount;
}
