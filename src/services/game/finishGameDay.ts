import type { PlayerBalance, Settlement } from '../../types/game';
import { calculateGameSettlements } from './settlementEngine';

export function finishGameDay(balances: PlayerBalance[]): Settlement[] {
  return calculateGameSettlements(balances);
}
