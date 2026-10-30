import type { Balance } from '../models/Balance';
import type { Settlement } from '../models/Settlement';
import { calculateMoneyTransfers } from './accounting';

export function calculateSettlements(balances: Balance[]): Settlement[] {
  return calculateMoneyTransfers(balances);
}
