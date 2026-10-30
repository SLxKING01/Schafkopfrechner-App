import type { PlayerBalance, Settlement } from '../../types/game';
import { calculateGameSettlements } from './settlementEngine';

export function finishGameDay(balances: PlayerBalance[]): Settlement[] {
  // TODO: store finished game day and final settlements in Supabase.
  return calculateGameSettlements(balances);
}
