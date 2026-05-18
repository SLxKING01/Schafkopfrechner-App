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
      <View style={styles.copy}>
        <AppText style={styles.title}>
          {from} zahlt {to}
        </AppText>
        <AppText style={styles.subtitle}>PayPal / QR vorbereitet</AppText>
      </View>
      <View style={styles.side}>
        <AppText style={styles.amount}>{amount}</AppText>
        <Pressable
          accessibilityRole="button"
          disabled={isPaid}
          onPress={onMarkPaid}
          style={[styles.button, isPaid && styles.buttonPaid]}
        >
          <AppText style={styles.buttonText}>
            {isPaid ? 'Bezahlt' : 'Als bezahlt markieren'}
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
    opacity: 0.58,
  },
  copy: {
    gap: authSpacing.xs,
  },
  title: {
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
    fontSize: 24,
    fontWeight: '900',
  },
  button: {
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
