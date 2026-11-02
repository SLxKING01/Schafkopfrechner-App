import type { GameTable, InterimPayment, PlayerBalance } from '../types/game';
import { toSafeCents } from './accounting';

/** Game balances stay untouched; actual transfers reduce the amounts still due. */
export function outstandingBalances(
  balances: PlayerBalance[],
  payments: InterimPayment[] = [],
): PlayerBalance[] {
  const ledger = new Map(
    balances.map(({ playerId, amount }) => {
      const cents = toSafeCents(amount);
      if (cents === null) throw new Error('Ungültiger Spielsaldo.');
      return [playerId, cents] as const;
    }),
  );
  const seen = new Set<string>();
  for (const payment of payments) {
    const cents = toSafeCents(payment.amount);
    if (
      typeof payment.id !== 'string' ||
      !payment.id.trim() ||
      typeof payment.createdAt !== 'string' ||
      (payment.voidedAt !== undefined &&
        typeof payment.voidedAt !== 'string') ||
      seen.has(payment.id) ||
      !ledger.has(payment.fromPlayerId) ||
      !ledger.has(payment.toPlayerId) ||
      payment.fromPlayerId === payment.toPlayerId ||
      cents === null ||
      cents <= 0 ||
      !Number.isFinite(Date.parse(payment.createdAt)) ||
      (payment.voidedAt !== undefined &&
        !Number.isFinite(Date.parse(payment.voidedAt)))
    )
      throw new Error('Ungültige Zwischenzahlung.');
    seen.add(payment.id);
    if (payment.voidedAt) continue;
    for (const [id, delta] of [
      [payment.fromPlayerId, cents],
      [payment.toPlayerId, -cents],
    ] as const) {
      const next = ledger.get(id)! + delta;
      if (!Number.isSafeInteger(next))
        throw new Error('Zwischenzahlung überschreitet den sicheren Betrag.');
      ledger.set(id, next);
    }
  }
  return balances.map(({ playerId }) => {
    const cents = ledger.get(playerId)!;
    const amount = cents / 100;
    if (toSafeCents(amount) !== cents)
      throw new Error('Offener Betrag ist nicht sicher darstellbar.');
    return { playerId, amount };
  });
}

export function paymentRevision(
  table: GameTable,
  balances: PlayerBalance[],
): string {
  return JSON.stringify([table.id, balances, table.interimPayments ?? []]);
}
