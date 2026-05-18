import type { PlayerBalance, Settlement } from '../../types/game';

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(cents: number) {
  return cents / 100;
}

export function calculateGameSettlements(
  balances: PlayerBalance[],
): Settlement[] {
  const debtors = balances
    .map((balance) => ({
      playerId: balance.playerId,
      cents: toCents(balance.amount),
    }))
    .filter((balance) => balance.cents < 0)
    .sort((a, b) => a.playerId.localeCompare(b.playerId));

  const creditors = balances
    .map((balance) => ({
      playerId: balance.playerId,
      cents: toCents(balance.amount),
    }))
    .filter((balance) => balance.cents > 0)
    .sort((a, b) => a.playerId.localeCompare(b.playerId));

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(Math.abs(debtor.cents), creditor.cents);

    if (amount > 0 && debtor.playerId !== creditor.playerId) {
      settlements.push({
        id: `${debtor.playerId}-${creditor.playerId}-${amount}`,
        fromPlayerId: debtor.playerId,
        toPlayerId: creditor.playerId,
        amount: fromCents(amount),
        isPaid: false,
      });
    }

    debtor.cents += amount;
    creditor.cents -= amount;

    if (debtor.cents === 0) {
      debtorIndex += 1;
    }

    if (creditor.cents === 0) {
      creditorIndex += 1;
    }
  }

  return settlements;
}
