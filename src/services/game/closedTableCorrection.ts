import * as Crypto from 'expo-crypto';

import { correctedRound, roundHistoryActor } from '../../store/gameStore';
import type { ArchivedGameDay, CreateRoundPayload } from '../../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
} from '../../utils/accounting';
import { outstandingBalances } from '../../utils/interimPayments';
import { appendRoundHistory } from '../../utils/roundHistory';
import { replayStockRules } from '../../utils/stockRules';
import { type PaymentEvent, paymentState } from '../shared/settlementEvents';
import { calculateGameSettlements } from './settlementEngine';

export function planClosedTableCorrection(
  day: ArchivedGameDay,
  roundId: string,
  payload: CreateRoundPayload,
  events: PaymentEvent[],
) {
  if (day.table.isActive)
    throw new Error('Der Tisch ist noch nicht abgeschlossen.');
  const changed = correctedRound(day, roundId, payload);
  if (!changed)
    throw new Error('Diese Korrektur passt nicht zur ursprünglichen Runde.');
  const proposed = day.rounds.map((round) =>
    round.id === roundId ? changed : round,
  );
  const closing = proposed.at(-1);
  const refund = closing?.stockAction === 'refund' ? closing : undefined;
  const rounds = replayStockRules(
    refund ? proposed.slice(0, -1) : proposed,
    day.table,
  );
  const stock = getStockBalanceCents(rounds);
  if (refund && stock > 0) rounds.push({ ...refund, amount: stock / 100 });
  if (getStockBalanceCents(rounds) !== 0)
    throw new Error(
      'Für diesen Rest-Stock ist keine historische Verteilung hinterlegt.',
    );

  const balances = calculateRoundBalances(day.players, rounds, 'id');
  const entries = day.settlements.map((payment) => ({
    payment,
    ...paymentState(payment, events),
  }));
  const confirmed = entries
    .filter((entry) => entry.confirmed)
    .map(({ payment }) => payment);
  const now = new Date().toISOString();
  const id = Crypto.randomUUID();
  const actor = roundHistoryActor();
  const correctedTable = appendRoundHistory(
    day.table,
    day.rounds,
    rounds,
    day.players,
    actor,
    roundId,
  );
  if (correctedTable === day.table)
    throw new Error('Die Runde wurde nicht verändert.');
  const remaining = outstandingBalances(balances, [
    ...(day.table.interimPayments ?? []),
    ...confirmed.map((payment) => ({
      ...payment,
      id: `confirmed:${payment.id}`,
      createdAt: now,
    })),
  ]);
  return {
    pending: entries.some((entry) => entry.reported && !entry.confirmed),
    expectedEvent: events.at(-1)?.id ?? null,
    day: {
      ...day,
      table: {
        ...correctedTable,
        settlementRevisions: [
          ...(day.table.settlementRevisions ?? []),
          {
            id,
            occurredAt: now,
            actor,
            balances: day.balances,
            settlements: day.settlements,
            carriedPaymentIds: confirmed.map((payment) => payment.id),
          },
        ],
      },
      rounds,
      balances,
      settlements: [
        ...confirmed,
        ...calculateGameSettlements(remaining).map((payment) => ({
          ...payment,
          id: `${id}:${payment.id}`,
        })),
      ],
    },
  };
}
