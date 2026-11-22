import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';
import { supabase } from '../../lib/supabase';
import {
  type PaymentAction,
  paymentActionLabels,
  type PaymentEvent,
  paymentState,
  recordSettlementEvent,
} from '../../services/shared/settlementEvents';
import { useAuthStore } from '../../store/authStore';
import { authColors, authSpacing } from '../../theme';
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
const shortDate = (value: string) =>
  new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export function PersonalSettlementsScreen() {
  const actor = useAuthStore((state) => state.user?.id);
  const focused = useIsFocused();
  const navigation = useNavigation();
  const [data, setData] = useState<{
    actor: string;
    tables: PersonalSettlement[];
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
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
          setError('Frühere Abrechnungen konnten nicht geladen werden.');
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
  const finished = tables?.filter((table) => !table.active) ?? [];
  const running = tables?.filter((table) => table.active) ?? [];
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };
  const reload = () => {
    setError('');
    setRevision((value) => value + 1);
  };

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={reload}
            tintColor={authColors.gold}
          />
        }
      >
        <PageHeader title="Frühere Abrechnungen" onBack={goBack} />
        <AppText style={styles.hint}>
          Zahlungen von gemeinsamen Tischen, die du verlassen hast oder bei
          denen dein Zugriff beendet wurde.
        </AppText>
        {error ? <Notice>{error}</Notice> : null}
        {error ? (
          <AppButton
            title="Erneut laden"
            variant="secondary"
            onPress={reload}
          />
        ) : null}
        {actor && !tables && !error ? (
          <Notice tone="info">Abrechnungen werden geladen …</Notice>
        ) : null}
        {tables && !tables.length ? (
          <Notice tone="info">
            Noch nichts hier. Wenn du einen gemeinsamen Tisch verlässt, findest
            du seine Abrechnung und offene Zahlungen weiterhin hier.
          </Notice>
        ) : null}
        {finished.map((table) => {
          const history = table.payments.flatMap(
            (payment) => paymentState(payment, table.events).history,
          );
          return (
            <View key={table.tableId} style={styles.card}>
              <View style={styles.row}>
                <AppText
                  accessibilityRole="header"
                  style={[styles.title, styles.flex]}
                >
                  {table.name}
                </AppText>
                {table.balance !== null ? (
                  <AppText
                    style={[
                      styles.amount,
                      table.balance < 0 ? styles.negative : styles.positive,
                    ]}
                  >
                    {table.balance > 0 ? '+' : ''}
                    {euro.format(table.balance)}
                  </AppText>
                ) : null}
              </View>
              {!table.payments.length ? (
                <AppText style={styles.hint}>Keine Zahlungen nötig.</AppText>
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
                const undo = actions.find((a) => a.startsWith('undo_'));
                const primary = actions.filter((a) => !a.startsWith('undo_'));
                const last = status.history.at(-1);
                const from =
                  payment.fromPlayerId === table.playerId
                    ? 'Du'
                    : payment.fromName;
                const to =
                  payment.toPlayerId === table.playerId
                    ? 'dich'
                    : payment.toName;
                return (
                  <View key={payment.id} style={styles.payment}>
                    <View style={styles.row}>
                      <View style={styles.flex}>
                        <AppText style={styles.strong}>
                          {from} → {to}
                        </AppText>
                        <View style={styles.statusRow}>
                          <AppText
                            style={[
                              styles.status,
                              (status.confirmed || status.reported) &&
                                styles.positive,
                            ]}
                          >
                            {status.label}
                            {last ? ` · ${shortDate(last.occurred_at)}` : ''}
                          </AppText>
                          {undo ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={paymentActionLabels[undo]}
                              disabled={busy}
                              hitSlop={10}
                              onPress={() => void record(table, payment, undo)}
                            >
                              <AppText style={styles.link}>
                                · Rückgängig
                              </AppText>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                      <AppText style={styles.gold}>
                        {euro.format(payment.amount)}
                      </AppText>
                    </View>
                    {primary.map((action) => (
                      <AppButton
                        key={action}
                        title={paymentActionLabels[action]}
                        variant="secondary"
                        disabled={busy}
                        onPress={() => void record(table, payment, action)}
                      />
                    ))}
                  </View>
                );
              })}
              {history.length ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: expanded === table.tableId }}
                  onPress={() =>
                    setExpanded(
                      expanded === table.tableId ? null : table.tableId,
                    )
                  }
                  style={styles.disclosure}
                >
                  <AppText style={styles.hint}>
                    Verlauf ({history.length}){' '}
                    {expanded === table.tableId ? '▴' : '▾'}
                  </AppText>
                </Pressable>
              ) : null}
              {expanded === table.tableId
                ? history.map((event) => (
                    <AppText key={event.id} style={styles.hint}>
                      {event.actor_name} · {paymentActionLabels[event.action]} ·{' '}
                      {shortDate(event.occurred_at)}
                    </AppText>
                  ))
                : null}
            </View>
          );
        })}
        {running.length ? (
          <View style={styles.stack}>
            <AppText style={styles.section}>Noch laufend</AppText>
            {running.map((table) => (
              <View key={table.tableId} style={[styles.card, styles.muted]}>
                <AppText style={styles.title}>{table.name}</AppText>
                <AppText style={styles.hint}>
                  Der Tisch läuft noch. Die Abrechnung erscheint nach dem
                  Abschluss.
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: authSpacing.md,
    paddingBottom: 48,
    paddingHorizontal: authSpacing.xl,
  },
  stack: { gap: authSpacing.md },
  hint: { color: authColors.textSecondary, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: authColors.surfaceElevated,
    borderColor: authColors.borderGold,
    borderRadius: 22,
    borderWidth: 1,
    gap: authSpacing.md,
    padding: authSpacing.lg,
  },
  muted: { borderColor: authColors.borderSoft },
  payment: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    gap: authSpacing.sm,
    padding: authSpacing.md,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: authSpacing.md },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  flex: { flex: 1, minWidth: 0 },
  title: { color: authColors.textPrimary, fontSize: 17, fontWeight: '700' },
  section: {
    color: authColors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: authSpacing.sm,
  },
  strong: { color: authColors.textPrimary, fontWeight: '700' },
  status: { color: authColors.textSecondary, fontSize: 13 },
  link: {
    color: authColors.accentGreen,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  amount: { fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '800' },
  gold: {
    color: authColors.goldHighlight,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  positive: { color: '#8FD19A' },
  negative: { color: authColors.errorText },
  disclosure: { justifyContent: 'center', minHeight: 36 },
});
