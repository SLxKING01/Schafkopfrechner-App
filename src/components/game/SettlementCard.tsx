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
};

export function SettlementCard({
  from,
  to,
  amount,
  isPaid = false,
  onMarkPaid,
}: SettlementCardProps) {
  return (
    <View style={[styles.card, isPaid && styles.paid]}>
      <View style={styles.paymentRow}>
        <AppText selectable style={styles.title}>
          {from} → {to}
        </AppText>
        <AppText selectable style={styles.amount}>
          {amount}
        </AppText>
      </View>
      <View style={styles.side}>
        <AppText style={styles.subtitle}>
          {isPaid ? 'Bezahlt' : 'Offene Zahlung'}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${from} an ${to}, ${amount}: ${isPaid ? 'Zahlung wieder öffnen' : 'als bezahlt markieren'}`}
          onPress={onMarkPaid}
          style={[styles.button, isPaid && styles.buttonPaid]}
        >
          <AppText style={styles.buttonText}>
            {isPaid ? 'Bezahlt · Rückgängig' : 'Als bezahlt markieren'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(13, 27, 19, 0.78)',
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    gap: authSpacing.md,
    padding: authSpacing.lg,
  },
  paid: {
    borderColor: authColors.accentGreen,
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: authSpacing.sm,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 130,
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '900',
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
  },
  side: {
    alignItems: 'flex-start',
    gap: authSpacing.sm,
  },
  amount: {
    color: authColors.goldHighlight,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: authColors.gold,
    borderRadius: authRadius.pill,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  buttonPaid: {
    backgroundColor: authColors.accentGreen,
  },
  buttonText: {
    color: authColors.background,
    fontSize: authTypography.tiny,
    fontWeight: '900',
  },
});
