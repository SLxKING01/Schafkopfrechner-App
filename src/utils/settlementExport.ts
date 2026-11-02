import type {
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../types/game';
import { toSafeCents } from './accounting';
import { outstandingBalances } from './interimPayments';

export type SettlementExport = {
  tableName: string;
  completedAt: string | null;
  generatedAt: string;
  balances: { name: string; amount: number }[];
  openPayments: ExportPayment[];
  paidPayments: ExportPayment[];
  interimPayments: ExportPayment[];
};
type ExportPayment = { from: string; to: string; amount: number };

/** Deliberately project only the public fields needed in the shared image. */
export function createSettlementExport(
  table: GameTable,
  players: Player[],
  balances: PlayerBalance[],
  settlements: Settlement[],
  completedAt: string | null,
  generatedAt = new Date().toISOString(),
): SettlementExport {
  if (table.isActive) throw new Error('Bitte den Tisch zuerst abschließen.');
  const names = new Map(players.map((p) => [p.id, p.name]));
  if (!names.size || names.size !== players.length)
    throw new Error('Die Spielerzuordnung ist unvollständig.');
  const name = (id: string) => {
    const value = names.get(id);
    if (!value?.trim()) throw new Error('Ein Spielername fehlt.');
    return value;
  };
  const payment = (
    p: Pick<Settlement, 'fromPlayerId' | 'toPlayerId' | 'amount'>,
  ) => {
    const cents = toSafeCents(p.amount);
    if (cents === null || cents <= 0 || p.fromPlayerId === p.toPlayerId)
      throw new Error('Ein Zahlungsbetrag ist ungültig.');
    return {
      from: name(p.fromPlayerId),
      to: name(p.toPlayerId),
      amount: cents / 100,
    };
  };
  if (
    balances.length !== names.size ||
    new Set(balances.map((b) => b.playerId)).size !== names.size ||
    balances.some((b) => !names.has(b.playerId))
  )
    throw new Error('Die Endsalden sind unvollständig.');
  const remaining = outstandingBalances(balances, table.interimPayments);
  return {
    tableName: table.name,
    completedAt,
    generatedAt,
    balances: players.map((p) => ({
      name: name(p.id),
      amount: remaining.find((b) => b.playerId === p.id)!.amount,
    })),
    // Preserve the saved plan and its status; never recompute paid transfers.
    openPayments: settlements.filter((p) => !p.isPaid).map(payment),
    paidPayments: settlements.filter((p) => p.isPaid).map(payment),
    interimPayments: (table.interimPayments ?? [])
      .filter((p) => !p.voidedAt)
      .map(payment),
  };
}

export function exportMoney(amount: number, signed = false) {
  return `${signed && amount > 0 ? '+' : ''}${amount.toFixed(2).replace('.', ',')} €`;
}

export function exportDate(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

export function settlementExportDescription(data: SettlementExport) {
  const payments = (
    label: string,
    entries: SettlementExport['openPayments'],
  ) =>
    entries.length
      ? `${label}: ${entries.map((p) => `${p.from} an ${p.to}: ${exportMoney(p.amount)}`).join('; ')}.`
      : '';
  return [
    `Abrechnung ${data.tableName}. Stand: ${exportDate(data.generatedAt)}.`,
    `Endsalden nach Zwischenzahlungen, vor Abschlusszahlungen: ${data.balances.map((p) => `${p.name}: ${exportMoney(p.amount, true)}`).join('; ')}.`,
    data.openPayments.length
      ? payments('Noch zu zahlen', data.openPayments)
      : 'Keine Zahlungen offen.',
    payments('Als bezahlt markiert, nicht erneut zahlen', data.paidPayments),
    payments('Bereits während des Abends bezahlt', data.interimPayments),
    'Momentaufnahme. Spätere Änderungen sind in diesem Bild nicht enthalten.',
  ]
    .filter(Boolean)
    .join(' ');
}
