import { CreditCard } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type OpenSettlementCardProps = {
  from: string;
  to: string;
  amount: string;
  onPayPress: () => void;
};

export function OpenSettlementCard({
  from,
  to,
  amount,
  onPayPress,
}: OpenSettlementCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <AppText style={styles.title}>{from} schuldet</AppText>
        <AppText style={styles.subtitle}>{to}</AppText>
      </View>
      <View style={styles.side}>
        <AppText style={styles.amount}>{amount}</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={onPayPress}
          style={({ pressed }) => [styles.payButton, pressed && styles.pressed]}
        >
          <CreditCard
            color={authColors.background}
            size={14}
            strokeWidth={2.4}
          />
          <AppText style={styles.payText}>PayPal</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.78)',
    borderColor: 'rgba(212, 175, 55, 0.26)',
    borderRadius: authRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: authSpacing.lg,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    fontWeight: '700',
  },
  subtitle: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '900',
    marginTop: authSpacing.xs,
  },
  side: {
    alignItems: 'flex-end',
  },
  amount: {
    color: authColors.goldHighlight,
    fontSize: 20,
    fontWeight: '900',
  },
  payButton: {
    alignItems: 'center',
    backgroundColor: authColors.gold,
    borderRadius: authRadius.pill,
    flexDirection: 'row',
    gap: authSpacing.xs,
    marginTop: authSpacing.sm,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  payText: {
    color: authColors.background,
    fontSize: authTypography.tiny,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
