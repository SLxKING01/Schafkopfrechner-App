import type { StockAction } from '../types/game';

type Participant = { id: string };
type RoundInput = {
  winnerId: string;
  winnerIds?: string[];
  loserIds: string[];
  amount: number;
  gameType?: string;
  stockAction?: StockAction;
  declarerId?: string;
  partnerId?: string;
};
export function roundWinnerIds(
  round: Pick<RoundInput, 'winnerId' | 'winnerIds'>,
): string[] {
  return round.winnerIds ?? [round.winnerId];
}
type BalanceInput = { playerId: string; amount: number };

/** Accept decimal cents and floating-point noise, never actual fractions of a cent. */
export function toSafeCents(amount: number): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  const scaled = amount * 100;
  const cents = Math.round(scaled);
  const tolerance = Math.min(
    0.000001,
    Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4,
  );
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) <= tolerance
    ? cents === 0
      ? 0
      : cents
    : null;
}

function fromSafeCents(cents: number) {
  const amount = cents / 100;
  if (toSafeCents(amount) !== cents)
    throw new Error('Der Betrag ist nicht sicher in Cent darstellbar.');
  return amount;
}

function addCents(left: number, right: number) {
  const sum = left + right;
  if (!Number.isSafeInteger(sum))
    throw new Error('Der Gesamtbetrag ist zu groß.');
  return sum;
}

export function hasUniquePlayerIds(players: Participant[]) {
  return (
    players.every(({ id }) => typeof id === 'string' && id.trim().length > 0) &&
    new Set(players.map(({ id }) => id)).size === players.length
  );
}

export function isValidRound(round: RoundInput, players: Participant[]) {
  const cents = toSafeCents(round.amount);
  const ids = new Set(players.map(({ id }) => id));
  const winners = roundWinnerIds(round);
  if (!Array.isArray(winners) || !Array.isArray(round.loserIds)) return false;
  if (round.stockAction && round.stockAction !== 'payout') {
    if (
      !['deposit', 'carryIn', 'refund', 'carryOut'].includes(round.stockAction)
    )
      return false;
    return (
      hasUniquePlayerIds(players) &&
      players.length === 4 &&
      round.gameType === 'stock' &&
      round.winnerId === '' &&
      Array.isArray(winners) &&
      winners.length === 0 &&
      Array.isArray(round.loserIds) &&
      round.loserIds.length === 4 &&
      new Set(round.loserIds).size === 4 &&
      round.loserIds.every((id) => ids.has(id)) &&
      cents !== null &&
      cents > 0 &&
      cents % 4 === 0
    );
  }
  if (round.stockAction !== undefined && round.stockAction !== 'payout')
    return false;
  if (
    round.stockAction === 'payout' &&
    (!['rufspiel', 'sauspiel'].includes(round.gameType ?? '') ||
      players.length !== 4 ||
      winners.length !== 2 ||
      round.loserIds.length !== 2)
  )
    return false;
  if (round.declarerId !== undefined || round.partnerId !== undefined) {
    if (
      !round.declarerId ||
      !round.partnerId ||
      round.declarerId === round.partnerId ||
      !['rufspiel', 'sauspiel'].includes(round.gameType ?? '') ||
      !ids.has(round.declarerId) ||
      !ids.has(round.partnerId) ||
      winners.length !== 2 ||
      round.loserIds.length !== 2 ||
      winners.includes(round.declarerId) !==
        winners.includes(round.partnerId) ||
      (round.stockAction === 'payout' && !winners.includes(round.declarerId))
    )
      return false;
  }
  return (
    hasUniquePlayerIds(players) &&
    typeof round.winnerId === 'string' &&
    ids.has(round.winnerId) &&
    Array.isArray(winners) &&
    winners.length > 0 &&
    winners.includes(round.winnerId) &&
    new Set(winners).size === winners.length &&
    winners.every((id) => ids.has(id)) &&
    Array.isArray(round.loserIds) &&
    round.loserIds.length > 0 &&
    new Set(round.loserIds).size === round.loserIds.length &&
    round.loserIds.every((id) => ids.has(id) && !winners.includes(id)) &&
    cents !== null &&
    cents > 0
  );
}

/** Stock is a separate account. Payouts always empty it into two equal shares. */
export function getStockBalanceCents(
  rounds: Pick<RoundInput, 'amount' | 'stockAction'>[],
) {
  let pot = 0;
  for (const round of rounds) {
    if (round.stockAction === 'deposit' || round.stockAction === 'carryIn') {
      const cents = toSafeCents(round.amount);
      if (cents === null || cents <= 0 || cents % 4 !== 0)
        throw new Error('Ungültige Stock-Einzahlung.');
      pot = addCents(pot, cents);
    } else if (
      round.stockAction === 'refund' ||
      round.stockAction === 'carryOut'
    ) {
      if (toSafeCents(round.amount) !== pot || pot <= 0)
        throw new Error(
          'Die Stock-Rückgabe muss dem gesamten Topf entsprechen.',
        );
      pot = 0;
    } else if (round.stockAction === 'payout') {
      if (pot <= 0 || pot % 2 !== 0)
        throw new Error('Kein auszahlbarer Stock vorhanden.');
      pot = 0;
    }
  }
  return pot;
}

export function isStockBooking(round: { stockAction?: StockAction }) {
  return !!round.stockAction && round.stockAction !== 'payout';
}

/** The amount remains the total win. Remainder cents are assigned deterministically. */
export function calculateRoundBalances(
  players: Participant[],
  rounds: RoundInput[],
  order: 'input' | 'id' = 'input',
) {
  if (!hasUniquePlayerIds(players))
    throw new Error('Spieler-IDs müssen eindeutig sein.');
  const ledger = new Map(players.map(({ id }) => [id, 0]));
  let pot = 0;
  for (const round of rounds) {
    if (!isValidRound(round, players))
      throw new Error(
        'Ungültige Teilnehmer oder ungültiger Betrag in einem Spiel.',
      );
    const cents = toSafeCents(round.amount)!;
    if (round.stockAction === 'deposit' || round.stockAction === 'carryIn') {
      pot = addCents(pot, cents);
      for (const id of round.loserIds)
        ledger.set(id, addCents(ledger.get(id)!, -cents / 4));
      continue;
    }
    if (round.stockAction === 'refund' || round.stockAction === 'carryOut') {
      if (cents !== pot || pot <= 0)
        throw new Error('Ungültige Stock-Rückgabe.');
      for (const id of round.loserIds)
        ledger.set(id, addCents(ledger.get(id)!, cents / 4));
      pot = 0;
      continue;
    }
    const losers = order === 'id' ? [...round.loserIds].sort() : round.loserIds;
    const winners =
      order === 'id'
        ? [...roundWinnerIds(round)].sort()
        : roundWinnerIds(round);
    const winShare = Math.floor(cents / winners.length);
    const winRemainder = cents % winners.length;
    winners.forEach((id, index) =>
      ledger.set(
        id,
        addCents(ledger.get(id)!, winShare + (index < winRemainder ? 1 : 0)),
      ),
    );
    const share = Math.floor(cents / losers.length);
    const remainder = cents % losers.length;
    losers.forEach((id, index) =>
      ledger.set(
        id,
        addCents(ledger.get(id)!, -share - (index < remainder ? 1 : 0)),
      ),
    );
    if (round.stockAction === 'payout') {
      if (pot <= 0 || pot % 2 !== 0)
        throw new Error('Kein auszahlbarer Stock vorhanden.');
      for (const id of winners)
        ledger.set(id, addCents(ledger.get(id)!, pot / 2));
      pot = 0;
    }
  }
  const balances = players.map(({ id }) => ({
    playerId: id,
    amount: fromSafeCents(ledger.get(id)!),
  }));
  // While stock is held, the players' balances plus the pot sum to zero.
  if (
    balances.reduce(
      (sum, balance) => sum + BigInt(toSafeCents(balance.amount)!),
      BigInt(pot),
    ) !== 0n
  )
    throw new Error(
      'Die Salden und der Stock müssen zusammen null Cent ergeben.',
    );
  return balances;
}

function requireBalancedCents(balances: BalanceInput[]) {
  if (
    new Set(balances.map(({ playerId }) => playerId)).size !== balances.length
  )
    throw new Error('Salden enthalten doppelte Spieler.');
  let total = 0;
  let credits = 0;
  let debts = 0;
  const result = balances.map(({ playerId, amount }) => {
    const cents = toSafeCents(amount);
    if (typeof playerId !== 'string' || !playerId.trim() || cents === null)
      throw new Error('Ein Saldo ist ungültig.');
    total = addCents(total, cents);
    if (cents > 0) credits = addCents(credits, cents);
    else debts = addCents(debts, -cents);
    return { playerId, cents };
  });
  if (total !== 0 || credits !== debts)
    throw new Error('Die Salden müssen zusammen null Cent ergeben.');
  return result;
}

export function calculateMoneyTransfers(
  balances: BalanceInput[],
  order: 'input' | 'id' = 'input',
) {
  const entries = requireBalancedCents(balances);
  if (order === 'id')
    entries.sort((a, b) => a.playerId.localeCompare(b.playerId));
  const debtors = entries
    .filter(({ cents }) => cents < 0)
    .map((entry) => ({ ...entry, cents: -entry.cents }));
  const creditors = entries
    .filter(({ cents }) => cents > 0)
    .map((entry) => ({ ...entry }));
  const payments: {
    fromPlayerId: string;
    toPlayerId: string;
    amount: number;
  }[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const cents = Math.min(debtor.cents, creditor.cents);
    payments.push({
      fromPlayerId: debtor.playerId,
      toPlayerId: creditor.playerId,
      amount: fromSafeCents(cents),
    });
    debtor.cents -= cents;
    creditor.cents -= cents;
    if (debtor.cents === 0) debtorIndex++;
    if (creditor.cents === 0) creditorIndex++;
  }
  return payments;
}
