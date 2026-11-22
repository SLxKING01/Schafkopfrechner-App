import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { supabase } from '../../lib/supabase';
import {
  type PaymentAction,
  paymentActionLabels,
  type PaymentEvent,
  paymentState,
  recordSettlementEvent,
} from '../../services/shared/settlementEvents';
import { useAuthStore } from '../../store/authStore';
import { authSpacing } from '../../theme/spacing';
import type { Settlement } from '../../types/game';

type PersonalSettlement = {
  tableId: string;
  name: string;
  active: boolean;
  playerId: string;
  balance: number | null;
  payments: (Settlement & {
    fromName: string;
    toName: string;
    locked: boolean;
  })[];
  events: PaymentEvent[];
};

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});
const stack = { gap: authSpacing.md };

export function PersonalSettlementsScreen() {
  const actor = useAuthStore((state) => state.user?.id);
  const focused = useIsFocused();
  const [data, setData] = useState<{
    actor: string;
    tables: PersonalSettlement[];
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const writing = useRef(false);
  useEffect(() => {
    if (!actor || !focused) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let cancelled = false;
    void (async () => {
      try {
        const result = await supabase
          .rpc('sk_personal_settlements')
          .abortSignal(controller.signal);
        if (result.error || !Array.isArray(result.data))
          throw result.error ?? new Error();
        if (!cancelled) setData({ actor, tables: result.data });
      } catch {
        if (!cancelled)
          setError('Persönliche Abrechnungen konnten nicht geladen werden.');
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [actor, focused, revision]);

  async function record(
    table: PersonalSettlement,
    payment: Settlement,
    action: PaymentAction,
  ) {
    if (!actor || useAuthStore.getState().user?.id !== actor || writing.current)
      return;
    writing.current = true;
    setBusy(true);
    setError('');
    try {
      await recordSettlementEvent(
        table.tableId,
        payment.id,
        action,
        table.events,
      );
    } catch {
      setError(
        'Zahlung konnte nicht aktualisiert werden. Der Stand wird neu geladen.',
      );
    } finally {
      writing.current = false;
      setBusy(false);
      setRevision((value) => value + 1);
    }
  }

  const tables = actor && data?.actor === actor ? data.tables : undefined;
  return (
    <AuthBackground>
      <ScrollView contentContainerStyle={{ ...stack, padding: authSpacing.xl }}>
        <AppButton
          title="Abrechnungen aktualisieren"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setError('');
            setRevision((value) => value + 1);
          }}
        />
        {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
        {actor && !tables && !error ? (
          <AppText accessibilityLiveRegion="polite">
            Abrechnungen werden geladen …
          </AppText>
        ) : null}
        {tables?.length === 0 ? (
          <AppText>Es gibt keine Abrechnungen ehemaliger Tische.</AppText>
        ) : null}
        {tables?.map((table) => (
          <View key={table.tableId} style={stack}>
            <AppText variant="subtitle" accessibilityRole="header">
              {table.name}
            </AppText>
            {table.active ? (
              <AppText>
                Der Tisch läuft noch. Die Endabrechnung folgt nach dem
                Abschluss.
              </AppText>
            ) : (
              <>
                {table.balance !== null ? (
                  <AppText>Dein Endsaldo: {euro.format(table.balance)}</AppText>
                ) : null}
                {!table.payments.length ? (
                  <AppText>Keine Zahlungen.</AppText>
                ) : null}
                {table.payments.map((payment) => {
                  const status = paymentState(payment, table.events);
                  const actions: PaymentAction[] = [];
                  if (!payment.isPaid && !payment.locked) {
                    if (
                      payment.fromPlayerId === table.playerId &&
                      !status.confirmed
                    ) {
                      if (!status.reported) actions.push('report');
                      else if (status.report?.actor_id === actor)
                        actions.push('undo_report');
                    }
                    if (payment.toPlayerId === table.playerId) {
                      if (!status.confirmed) actions.push('confirm');
                      else if (status.confirmation?.actor_id === actor)
                        actions.push('undo_confirm');
                    }
                  }
                  return (
                    <View key={payment.id} style={stack}>
                      <AppText>
                        {payment.fromName} an {payment.toName}:{' '}
                        {euro.format(payment.amount)}
                      </AppText>
                      <AppText>{status.label}</AppText>
                      {status.history.map((event) => (
                        <AppText key={event.id}>
                          {event.actor_name} ·{' '}
                          {paymentActionLabels[event.action]} ·{' '}
                          {new Date(event.occurred_at).toLocaleString('de-DE')}
                        </AppText>
                      ))}
                      {actions.map((action) => (
                        <AppButton
                          key={action}
                          title={paymentActionLabels[action]}
                          disabled={busy}
                          onPress={() => void record(table, payment, action)}
                        />
                      ))}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        ))}
      </ScrollView>
    </AuthBackground>
  );
}
