import type { PlayerBalance, StockAction } from '../types/game';

type Participant = { id: string };

/** Balances (plus any held stock) do not sum to zero; carries the gap. */
export class BalanceMismatchError extends Error {
  constructor(
    readonly differenceCents: number,
    readonly includesStock = false,
  ) {
    super(
      includesStock
        ? 'Die Salden und der Stock müssen zusammen null Cent ergeben.'
        : 'Die Salden müssen zusammen null Cent ergeben.',
    );
    this.name = 'BalanceMismatchError';
  }
}

type RoundInput = {
  participantIds?: string[];
  seatOrderIds?: string[];
  customAmounts?: PlayerBalance[];
  winnerId: string;
  winnerIds?: string[];
  loserIds: string[];
  amount: number;
  gameType?: string;
  stockAction?: StockAction;
  declarerId?: string;
  partnerId?: string;
  declarerWon?: boolean;
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

export function isCustomBooking(round: {
  gameType?: string;
  customAmounts?: PlayerBalance[];
}) {
  return round.gameType === 'custom' && round.customAmounts !== undefined;
}

/** Amount is the transfer volume, not a guessed winner or uniform split. */
export function customTransferCents(amounts: PlayerBalance[]): number | null {
  if (!Array.isArray(amounts) || !amounts.length) return null;
  const seen = new Set<string>();
  let total = 0n;
  let positive = 0n;
  for (const entry of amounts) {
    if (
      !entry ||
      typeof entry.playerId !== 'string' ||
      !entry.playerId.trim() ||
      seen.has(entry.playerId)
    )
      return null;
    const cents = toSafeCents(entry.amount);
    if (cents === null) return null;
    seen.add(entry.playerId);
    total += BigInt(cents);
    if (cents > 0) positive += BigInt(cents);
  }
  return total === 0n &&
    positive > 0n &&
    positive <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(positive)
    : null;
}

/** Non-zero sum of an otherwise well-formed custom booking, else 0. */
function customBookingGapCents(round: RoundInput): number {
  if (!isCustomBooking(round) || !Array.isArray(round.customAmounts)) return 0;
  let total = 0;
  for (const entry of round.customAmounts) {
    const cents = entry ? toSafeCents(entry.amount) : null;
    if (cents === null) return 0;
    total += cents;
    if (!Number.isSafeInteger(total)) return 0;
  }
  return total;
}

export function isPlayedRound(round: {
  stockAction?: StockAction;
  gameType?: string;
  customAmounts?: PlayerBalance[];
}) {
  return !isStockBooking(round) && !isCustomBooking(round);
}

export function isValidRound(round: RoundInput, players: Participant[]) {
  const cents = toSafeCents(round.amount);
  const ids = new Set(players.map(({ id }) => id));
  const winners = roundWinnerIds(round);
  if (!Array.isArray(winners) || !Array.isArray(round.loserIds)) return false;
  if (
    round.seatOrderIds !== undefined &&
    (!Array.isArray(round.seatOrderIds) ||
      new Set(round.seatOrderIds).size !== round.seatOrderIds.length ||
      round.seatOrderIds.some((id) => !ids.has(id)))
  )
    return false;
  if (round.participantIds !== undefined) {
    if (
      !Array.isArray(round.participantIds) ||
      round.participantIds.length !== 4 ||
      new Set(round.participantIds).size !== 4 ||
      round.participantIds.some((id) => !ids.has(id))
    )
      return false;
    const parties =
      round.stockAction === 'deposit'
        ? round.loserIds
        : [...winners, ...round.loserIds];
    if (
      !Array.isArray(parties) ||
      parties.length !== 4 ||
      parties.some((id) => !round.participantIds!.includes(id))
    )
      return false;
  }
  if (round.customAmounts !== undefined) {
    return (
      isCustomBooking(round) &&
      hasUniquePlayerIds(players) &&
      customTransferCents(round.customAmounts) === cents &&
      cents !== null &&
      cents > 0 &&
      round.customAmounts.every((entry) => ids.has(entry.playerId)) &&
      round.stockAction === undefined &&
      round.declarerId === undefined &&
      round.partnerId === undefined &&
      round.winnerId === '' &&
      Array.isArray(winners) &&
      winners.length === 0 &&
      Array.isArray(round.loserIds) &&
      round.loserIds.length === 0
    );
  }
  if (!Array.isArray(winners) || !Array.isArray(round.loserIds)) return false;
  if (round.stockAction && !['payout', 'double'].includes(round.stockAction)) {
    if (
      !['deposit', 'carryIn', 'refund', 'carryOut'].includes(round.stockAction)
    )
      return false;
    return (
      hasUniquePlayerIds(players) &&
      round.gameType === 'stock' &&
      round.winnerId === '' &&
      Array.isArray(winners) &&
      winners.length === 0 &&
      Array.isArray(round.loserIds) &&
      round.loserIds.length > 0 &&
      (round.stockAction !== 'deposit' || round.loserIds.length === 4) &&
      new Set(round.loserIds).size === round.loserIds.length &&
      round.loserIds.every((id) => ids.has(id)) &&
      cents !== null &&
      cents > 0 &&
      ((round.stockAction !== 'deposit' && round.stockAction !== 'carryIn') ||
        cents % round.loserIds.length === 0)
    );
  }
  if (
    round.stockAction !== undefined &&
    !['payout', 'double'].includes(round.stockAction)
  )
    return false;
  if (
    ['payout', 'double'].includes(round.stockAction ?? '') &&
    (!['rufspiel', 'sauspiel'].includes(round.gameType ?? '') ||
      winners.length !== 2 ||
      round.loserIds.length !== 2)
  )
    return false;
  if (round.stockAction === 'double' && (!round.declarerId || !round.partnerId))
    return false;
  if (
    round.declarerId !== undefined ||
    round.partnerId !== undefined ||
    round.declarerWon !== undefined
  ) {
    if (!round.declarerId || !ids.has(round.declarerId)) return false;
    if (
      round.declarerWon !== undefined &&
      (typeof round.declarerWon !== 'boolean' ||
        round.declarerWon !== winners.includes(round.declarerId))
    )
      return false;
    if (
      ['rufspiel', 'sauspiel', 'hochzeit', 'kreuzbock'].includes(
        round.gameType ?? '',
      )
    ) {
      if (
        !round.partnerId ||
        round.declarerId === round.partnerId ||
        !ids.has(round.partnerId) ||
        winners.length !== 2 ||
        round.loserIds.length !== 2 ||
        winners.includes(round.declarerId) !==
          winners.includes(round.partnerId) ||
        (round.stockAction === 'payout' &&
          !winners.includes(round.declarerId)) ||
        (round.stockAction === 'double' && winners.includes(round.declarerId))
      )
        return false;
    } else {
      if (
        round.partnerId !== undefined ||
        ![...winners, ...round.loserIds].includes(round.declarerId)
      )
        return false;
      if (
        ['solo', 'wenz', 'farbwenz', 'geier', 'farbgeier', 'bettel'].includes(
          round.gameType ?? '',
        ) &&
        !(
          (winners.length === 1 && winners[0] === round.declarerId) ||
          (round.loserIds.length === 1 &&
            round.loserIds[0] === round.declarerId)
        )
      )
        return false;
    }
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
  initialPot = 0,
) {
  let pot = initialPot;
  for (const round of rounds) {
    if (round.stockAction === 'deposit' || round.stockAction === 'carryIn') {
      const cents = toSafeCents(round.amount);
      if (cents === null || cents <= 0)
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
    } else if (round.stockAction === 'double') {
      if (pot <= 0) throw new Error('Kein Stock zum Verdoppeln vorhanden.');
      pot = addCents(pot, pot);
    } else if (round.stockAction === 'payout') {
      if (pot <= 0) throw new Error('Kein auszahlbarer Stock vorhanden.');
      pot = 0;
    }
  }
  return pot;
}

export function isStockBooking(round: { stockAction?: StockAction }) {
  return (
    !!round.stockAction && !['payout', 'double'].includes(round.stockAction)
  );
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
    const gap = customBookingGapCents(round);
    if (gap) throw new BalanceMismatchError(gap);
    if (!isValidRound(round, players))
      throw new Error(
        'Ungültige Teilnehmer oder ungültiger Betrag in einem Spiel.',
      );
    const cents = toSafeCents(round.amount)!;
    if (isCustomBooking(round)) {
      for (const entry of round.customAmounts!)
        ledger.set(
          entry.playerId,
          addCents(ledger.get(entry.playerId)!, toSafeCents(entry.amount)!),
        );
      continue;
    }
    if (round.stockAction === 'deposit' || round.stockAction === 'carryIn') {
      pot = addCents(pot, cents);
      for (const id of round.loserIds)
        ledger.set(
          id,
          addCents(ledger.get(id)!, -cents / round.loserIds.length),
        );
      continue;
    }
    if (round.stockAction === 'refund' || round.stockAction === 'carryOut') {
      if (cents !== pot || pot <= 0)
        throw new Error('Ungültige Stock-Rückgabe.');
      const recipients = [...round.loserIds].sort();
      recipients.forEach((id, i) =>
        ledger.set(
          id,
          addCents(
            ledger.get(id)!,
            Math.floor(cents / recipients.length) +
              (i < cents % recipients.length ? 1 : 0),
          ),
        ),
      );
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
    if (round.stockAction === 'payout' || round.stockAction === 'double') {
      if (pot <= 0) throw new Error('Kein ausspielbarer Stock vorhanden.');
      const recipients = (
        round.stockAction === 'double'
          ? [round.declarerId!, round.partnerId!]
          : winners
      )
        .slice()
        .sort();
      const sign = round.stockAction === 'double' ? -1 : 1;
      recipients.forEach((id, i) =>
        ledger.set(
          id,
          addCents(
            ledger.get(id)!,
            sign * (Math.floor(pot / 2) + (i < pot % 2 ? 1 : 0)),
          ),
        ),
      );
      pot = round.stockAction === 'double' ? addCents(pot, pot) : 0;
    }
  }
  const balances = players.map(({ id }) => ({
    playerId: id,
    amount: fromSafeCents(ledger.get(id)!),
  }));
  // While stock is held, the players' balances plus the pot sum to zero.
  const total = balances.reduce(
    (sum, balance) => sum + BigInt(toSafeCents(balance.amount)!),
    BigInt(pot),
  );
  if (total !== 0n) throw new BalanceMismatchError(Number(total), pot > 0);
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
    throw new BalanceMismatchError(credits - debts);
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
  type Payment = { fromPlayerId: string; toPlayerId: string; amount: number };
  const memo = new Map<string, Payment[]>();
  // An optimal flow can be chosen without cycles. Its forest has a leaf,
  // so some debtor/creditor pair can always settle the smaller balance.
  // Explore every such pair; memoization avoids revisiting residual ledgers.
  function solve(): Payment[] {
    const key = [...debtors, ...creditors].map(({ cents }) => cents).join(',');
    const cached = memo.get(key);
    if (cached) return cached;
    const debtCount = debtors.filter(({ cents }) => cents > 0).length;
    const creditCount = creditors.filter(({ cents }) => cents > 0).length;
    if (!debtCount) return [];
    const lowerBound = Math.max(debtCount, creditCount);
    let best: Payment[] | undefined;
    search: for (const debtor of debtors) {
      if (!debtor.cents) continue;
      for (const creditor of creditors) {
        if (!creditor.cents) continue;
        const cents = Math.min(debtor.cents, creditor.cents);
        debtor.cents -= cents;
        creditor.cents -= cents;
        const candidate = [
          {
            fromPlayerId: debtor.playerId,
            toPlayerId: creditor.playerId,
            amount: fromSafeCents(cents),
          },
          ...solve(),
        ];
        debtor.cents += cents;
        creditor.cents += cents;
        if (!best || candidate.length < best.length) best = candidate;
        if (best.length === lowerBound) break search;
      }
    }
    memo.set(key, best!);
    return best!;
  }
  return solve();
}
