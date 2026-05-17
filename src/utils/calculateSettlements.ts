import type { Balance } from '../models/Balance';
import type { Settlement } from '../models/Settlement';

type OpenAmount = {
  playerId: string;
  amountInCents: number;
};

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(amountInCents: number) {
  return amountInCents / 100;
}

export function calculateSettlements(balances: Balance[]): Settlement[] {
  const debtors: OpenAmount[] = balances
    .map((balance) => ({
      playerId: balance.playerId,
      amountInCents: toCents(balance.amount),
    }))
    .filter((balance) => balance.amountInCents < 0)
    .map((balance) => ({
      playerId: balance.playerId,
      amountInCents: Math.abs(balance.amountInCents),
    }));

  const creditors: OpenAmount[] = balances
    .map((balance) => ({
      playerId: balance.playerId,
      amountInCents: toCents(balance.amount),
    }))
    .filter((balance) => balance.amountInCents > 0);

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const paymentInCents = Math.min(
      debtor.amountInCents,
      creditor.amountInCents,
    );

    if (paymentInCents > 0 && debtor.playerId !== creditor.playerId) {
      settlements.push({
        fromPlayerId: debtor.playerId,
        toPlayerId: creditor.playerId,
        amount: fromCents(paymentInCents),
      });
    }

    debtor.amountInCents -= paymentInCents;
    creditor.amountInCents -= paymentInCents;

    if (debtor.amountInCents === 0) {
      debtorIndex += 1;
    }

    if (creditor.amountInCents === 0) {
      creditorIndex += 1;
    }
  }

  return settlements;
}
