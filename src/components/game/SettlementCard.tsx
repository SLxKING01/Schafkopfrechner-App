import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type SettlementCardProps = {
  from: string;
  to: string;
  amount: string;
  isPaid?: boolean;
  onMarkPaid?: () => void;
  status?: string;
  children?: ReactNode;
};

/**
 * One payment "from → to". Open payments show a small "Bezahlt" chip; paid
 * ones show "Bezahlt · Rückgängig" as a quiet text link instead of a big button.
 */
export function SettlementCard({
  from,
  to,
  amount,
  isPaid = false,
  onMarkPaid,
  status,
  children,
}: SettlementCardProps) {
  const label = `${from} an ${to}, ${amount}: ${isPaid ? 'Zahlung wieder öffnen' : 'als bezahlt markieren'}`;
  return (
    <View style={[styles.card, isPaid && styles.paid]}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <AppText selectable style={styles.title}>
            {from} → {to}
          </AppText>
          {onMarkPaid && isPaid ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              hitSlop={10}
              onPress={onMarkPaid}
            >
              <AppText style={styles.paidLink}>
                Bezahlt · <AppText style={styles.undo}>Rückgängig</AppText>
              </AppText>
            </Pressable>
          ) : (
            <AppText style={[styles.status, isPaid && styles.paidText]}>
              {status ?? (isPaid ? 'Bezahlt' : 'Offen')}
            </AppText>
          )}
        </View>
        <AppText selectable style={styles.amount}>
          {amount}
        </AppText>
        {onMarkPaid && !isPaid ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onMarkPaid}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <AppText style={styles.chipText}>Bezahlt</AppText>
          </Pressable>
        ) : null}
      </View>
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(13, 27, 19, 0.78)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    gap: authSpacing.sm,
    paddingHorizontal: authSpacing.lg,
    paddingVertical: authSpacing.md,
  },
  paid: { borderColor: 'rgba(107, 163, 110, 0.55)' },
  row: { alignItems: 'center', flexDirection: 'row', gap: authSpacing.md },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '700',
  },
  status: { color: authColors.textSecondary, fontSize: authTypography.caption },
  paidText: { color: authColors.accentGreen },
  paidLink: {
    color: authColors.accentGreen,
    fontSize: authTypography.caption,
    fontWeight: '600',
  },
  undo: {
    color: authColors.accentGreen,
    fontSize: authTypography.caption,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  amount: {
    color: authColors.goldHighlight,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  chip: {
    borderColor: authColors.borderGold,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: authSpacing.md,
  },
  chipText: {
    color: authColors.goldHighlight,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: { opacity: 0.8 },
  extra: { alignItems: 'flex-start', gap: authSpacing.sm },
});
