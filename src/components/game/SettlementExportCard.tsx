import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authSpacing } from '../../theme/spacing';
import {
  exportDate,
  exportMoney,
  type SettlementExport,
} from '../../utils/settlementExport';
import { AppText } from '../ui/AppText';

export const SETTLEMENT_IMAGE_WIDTH = 480;

type Payment = SettlementExport['openPayments'][number];

// Group by the displayed recipient, preserving every individual payment.
// Names remain presentation only; the saved payment plan is never changed.
function PaymentGroups({
  entries,
  subdued = false,
}: {
  entries: Payment[];
  subdued?: boolean;
}) {
  const groups = new Map<string, Payment[]>();
  for (const entry of entries) {
    const group = groups.get(entry.to) ?? [];
    group.push(entry);
    groups.set(entry.to, group);
  }
  return (
    <>
      {[...groups].map(([recipient, payments]) => (
        <View key={recipient} style={styles.paymentGroup}>
          <AppText style={[styles.recipient, subdued && styles.muted]}>
            An {recipient}
          </AppText>
          {payments.map((payment, index) => (
            <View key={index} style={styles.paymentRow}>
              <AppText style={[styles.name, subdued && styles.muted]}>
                {payment.from}
              </AppText>
              <AppText
                style={[
                  styles.money,
                  !subdued && styles.gold,
                  subdued && styles.muted,
                ]}
              >
                {exportMoney(payment.amount)}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

export function SettlementExportCard({ data }: { data: SettlementExport }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRule} />
      <View style={styles.header}>
        <AppText style={styles.brand}>SCHAFKOPFRECHNER</AppText>
        <AppText style={styles.title}>{data.tableName}</AppText>
        <AppText style={styles.meta}>
          Abrechnung · {data.balances.length} Spieler
          {data.completedAt
            ? ` · ${new Date(data.completedAt).toLocaleDateString('de-DE')}`
            : ''}
        </AppText>
      </View>

      <View style={styles.paymentPanel}>
        <View style={styles.sectionHeader}>
          <AppText style={styles.heading}>
            {data.openPayments.length ? 'Wer zahlt wem?' : 'Alles ausgeglichen'}
          </AppText>
          <AppText style={styles.badge}>
            {data.openPayments.length
              ? `${data.openPayments.length} offen`
              : '✓'}
          </AppText>
        </View>
        {data.openPayments.length ? (
          <PaymentGroups entries={data.openPayments} />
        ) : (
          <AppText style={styles.note}>
            {data.paidPayments.length
              ? 'Alle Abschlusszahlungen als bezahlt markiert.'
              : 'Keine weiteren Zahlungen nötig.'}
          </AppText>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText style={styles.heading}>Endsalden</AppText>
          <AppText style={styles.meta}>+ Guthaben / − zu zahlen</AppText>
        </View>
        {data.balances.map((player, index) => (
          <View key={index} style={styles.balanceRow}>
            <AppText style={styles.name}>{player.name}</AppText>
            <AppText
              style={[
                styles.money,
                player.amount > 0 && styles.gold,
                player.amount === 0 && styles.muted,
              ]}
            >
              {exportMoney(player.amount, true)}
            </AppText>
          </View>
        ))}
        <AppText style={styles.small}>
          Nach Zwischenzahlungen, vor Abschlusszahlungen.
        </AppText>
      </View>

      {data.paidPayments.length ? (
        <View style={styles.history}>
          <AppText style={styles.historyTitle}>
            Bereits bezahlt · nicht erneut zahlen
          </AppText>
          <PaymentGroups entries={data.paidPayments} subdued />
        </View>
      ) : null}
      {data.interimPayments.length ? (
        <View style={styles.history}>
          <AppText style={styles.historyTitle}>
            Zwischenzahlungen · bereits berücksichtigt
          </AppText>
          <PaymentGroups entries={data.interimPayments} subdued />
        </View>
      ) : null}
      <View style={styles.footer}>
        <AppText style={styles.small}>
          Stand: {exportDate(data.generatedAt)}
        </AppText>
        <AppText style={styles.small}>
          Momentaufnahme · spätere Änderungen nicht enthalten
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: authColors.backgroundSoft,
    padding: authSpacing.xl,
    gap: authSpacing.lgPlus,
  },
  topRule: { height: 3, width: 40, backgroundColor: authColors.gold },
  header: { gap: authSpacing.sm },
  brand: {
    color: authColors.goldHighlight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
  },
  meta: { color: authColors.textSecondary, fontSize: 11, lineHeight: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: authSpacing.sm,
  },
  heading: { color: authColors.textPrimary, fontSize: 17, fontWeight: '700' },
  badge: { color: authColors.goldHighlight, fontSize: 11, fontWeight: '600' },
  paymentPanel: {
    backgroundColor: authColors.control,
    borderWidth: 1,
    borderColor: authColors.controlBorder,
    borderRadius: 16,
    padding: authSpacing.lg,
    gap: authSpacing.md,
  },
  paymentGroup: { gap: authSpacing.xs },
  recipient: {
    color: authColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: authSpacing.md,
    paddingVertical: authSpacing.xs,
  },
  section: { gap: authSpacing.xs },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: authSpacing.md,
    paddingVertical: authSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: authColors.borderSoft,
  },
  name: {
    flex: 1,
    minWidth: 0,
    color: authColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  money: {
    maxWidth: '45%',
    flexShrink: 0,
    textAlign: 'right',
    color: authColors.textPrimary,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  gold: { color: authColors.goldHighlight },
  muted: { color: authColors.textSecondary },
  note: { color: authColors.textSecondary, fontSize: 14, lineHeight: 20 },
  small: { color: authColors.textSecondary, fontSize: 10, lineHeight: 15 },
  history: { gap: authSpacing.sm },
  historyTitle: {
    color: authColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingTop: authSpacing.md,
    borderTopWidth: 1,
    borderTopColor: authColors.borderSoft,
    gap: 2,
  },
});
