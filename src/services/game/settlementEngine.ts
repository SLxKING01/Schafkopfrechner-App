import type { PlayerBalance, Settlement } from '../../types/game';
import { calculateMoneyTransfers, toSafeCents } from '../../utils/accounting';

export function calculateGameSettlements(
  balances: PlayerBalance[],
): Settlement[] {
  return calculateMoneyTransfers(balances, 'id').map((payment) => ({
    ...payment,
    id: `${payment.fromPlayerId}-${payment.toPlayerId}-${toSafeCents(payment.amount)}`,
    isPaid: false,
  }));
}
