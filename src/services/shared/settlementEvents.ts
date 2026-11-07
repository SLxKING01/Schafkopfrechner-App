import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';

import { supabase } from '../../lib/supabase';
import type { GameTable, Player, Settlement } from '../../types/game';

export const paymentActionLabels = {
  report: 'Als bezahlt melden',
  confirm: 'Geld erhalten',
  undo_report: 'Meldung zurücknehmen',
  undo_confirm: 'Bestätigung zurücknehmen',
};
export type PaymentAction = keyof typeof paymentActionLabels;
type PaymentEvent = {
  id: string;
  payment_id: string;
  action: PaymentAction;
  actor_id: string;
  actor_name: string;
  player_name: string;
  delegated: boolean;
  occurred_at: string;
};

type PayPalTarget = {
  paymentId: string;
  recipientId: string;
  handle: string;
  amount: number;
};

export function paymentState(payment: Settlement, events: PaymentEvent[]) {
  const history = events.filter((event) => event.payment_id === payment.id);
  const report = history.findLast(
    ({ action }) => action === 'report' || action === 'undo_report',
  );
  const confirmation = history.findLast(
    ({ action }) => action === 'confirm' || action === 'undo_confirm',
  );
  const confirmed = payment.isPaid || confirmation?.action === 'confirm';
  const reported = report?.action === 'report';
  return {
    history,
    report,
    confirmation,
    confirmed,
    reported,
    label: payment.isPaid
      ? 'Bezahlt (Altbestand)'
      : confirmed
        ? 'Eingang bestätigt'
        : reported
          ? 'Als bezahlt gemeldet'
          : 'Offen',
  };
}

export function allowedPaymentActions(
  payment: Settlement,
  state: ReturnType<typeof paymentState>,
  players: Player[],
  table: GameTable,
  actorId: string | undefined,
): PaymentAction[] {
  if (!actorId || actorId !== table.shared?.userId || payment.isPaid) return [];
  const represents = (id: string) => {
    const player = players.find((candidate) => candidate.id === id);
    return (
      !!player &&
      (player.userId
        ? player.userId === actorId
        : table.shared?.ownerId === actorId)
    );
  };
  const actions: PaymentAction[] = [];
  if (!state.confirmed && represents(payment.fromPlayerId)) {
    if (!state.reported) actions.push('report');
    else if (state.report?.actor_id === actorId) actions.push('undo_report');
  }
  if (represents(payment.toPlayerId)) {
    if (!state.confirmed) actions.push('confirm');
    else if (state.confirmation?.actor_id === actorId)
      actions.push('undo_confirm');
  }
  return actions;
}

export function useSettlementEvents(
  tableId: string | undefined,
  actorId: string | undefined,
) {
  const scope = tableId && actorId ? `${actorId}:${tableId}` : undefined;
  const [snapshot, setSnapshot] = useState<{
    scope: string;
    events: PaymentEvent[];
    links: PayPalTarget[];
  }>();
  const [failure, setFailure] = useState<{ scope: string; message: string }>();
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!scope || !tableId) return;
    let active = true;
    let loading = false;
    async function load() {
      if (loading) return;
      loading = true;
      try {
        const { data, error } = await supabase.rpc(
          'sk_read_settlement_checkout',
          { p_table_id: tableId },
        );
        let result = data;
        if (error?.code === 'PGRST202') {
          const legacy = await supabase.rpc('sk_read_settlement_events', {
            p_table_id: tableId,
          });
          if (legacy.error) throw legacy.error;
          result = { events: legacy.data, links: [] };
        } else if (error) throw error;
        if (!Array.isArray(result?.events) || !Array.isArray(result?.links))
          throw Error();
        if (active) {
          setSnapshot({
            scope: scope!,
            events: result.events,
            links: result.links,
          });
          setFailure(undefined);
        }
      } catch {
        if (active) {
          setSnapshot(undefined);
          setFailure({
            scope: scope!,
            message: 'Zahlungsstatus konnten nicht geladen werden.',
          });
        }
      } finally {
        loading = false;
      }
    }
    void load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [scope, tableId, refresh]);

  const events = snapshot?.scope === scope ? snapshot?.events : undefined;
  async function record(paymentId: string, action: PaymentAction) {
    if (!tableId || !events || writing.current) return;
    writing.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('sk_record_settlement_event', {
        p_table_id: tableId,
        p_payment_id: paymentId,
        p_action: action,
        p_request_id: Crypto.randomUUID(),
        p_expected_event:
          events.findLast((event) => event.payment_id === paymentId)?.id ??
          null,
      });
      if (error) throw error;
    } finally {
      writing.current = false;
      setBusy(false);
      setRefresh((value) => value + 1);
    }
  }
  return {
    events,
    links: snapshot?.scope === scope ? snapshot?.links : undefined,
    busy,
    error: failure?.scope === scope ? failure?.message : undefined,
    record,
  };
}
