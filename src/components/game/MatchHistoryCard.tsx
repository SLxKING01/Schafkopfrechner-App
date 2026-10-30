import { Pressable, StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type MatchHistoryCardProps = {
  winner: string;
  losers: string;
  amount: string;
  time: string;
  gameType: string;
  stockDeposit?: boolean;
  stockBooking?: string;
  details?: string;
  compact?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function MatchHistoryCard({
  winner,
  losers,
  amount,
  time,
  gameType,
  stockDeposit,
  stockBooking,
  details,
  compact = false,
  onPress,
  accessibilityLabel,
}: MatchHistoryCardProps) {
  if (compact) {
    const content = (
      <>
        <View style={styles.gameColumn}>
          <AppText numberOfLines={2} style={styles.tableTitle}>
            {stockBooking ?? (stockDeposit ? 'Stock eingezahlt' : gameType)}
          </AppText>
          <AppText style={styles.tableTime}>{time}</AppText>
        </View>
        <View style={styles.winnerColumn}>
          <AppText numberOfLines={2} style={styles.tableWinner}>
            {stockBooking || stockDeposit ? 'Alle vier' : winner}
          </AppText>
        </View>
        <AppText style={styles.tableAmount}>+{amount}</AppText>
      </>
    );
    const label = `${gameType}, ${stockBooking ?? (stockDeposit ? 'Stock eingezahlt' : `Gewinner ${winner}, gegen ${losers}`)}, ${amount}, ${time}${details ? `, ${details}` : ''}`;
    return onPress ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={`${label}. Öffnet die Spielkonfiguration zum Bearbeiten.`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tableRow,
          pressed && styles.tablePressed,
        ]}
      >
        {content}
      </Pressable>
    ) : (
      <View accessible accessibilityLabel={label} style={styles.tableRow}>
        {content}
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.timelineDot} />
      <View style={styles.copy}>
        <AppText style={styles.title}>
          {stockBooking ??
            (stockDeposit ? 'Stock eingezahlt' : `${winner} gewinnt`)}
        </AppText>
        <AppText style={styles.subtitle}>
          {stockDeposit || stockBooking
            ? `Alle vier · ${losers}`
            : `${gameType} · gegen ${losers}`}
        </AppText>
        {details ? <AppText style={styles.subtitle}>{details}</AppText> : null}
        <AppText style={styles.time}>{time}</AppText>
      </View>
      <AppText style={styles.amount}>+{amount}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    minHeight: 60,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
    backgroundColor: authColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: authColors.borderSoft,
  },
  tablePressed: { backgroundColor: authColors.control },
  gameColumn: { flex: 1.1, minWidth: 0 },
  winnerColumn: { flex: 1, minWidth: 0 },
  tableTitle: {
    color: authColors.textPrimary,
    fontSize: authTypography.caption,
    fontWeight: '700',
  },
  tableWinner: {
    color: authColors.textPrimary,
    fontSize: authTypography.caption,
  },
  tableTime: {
    color: authColors.textSecondary,
    fontSize: authTypography.tiny,
    marginTop: 2,
  },
  tableAmount: {
    width: 78,
    textAlign: 'right',
    color: authColors.accentGreen,
    fontSize: authTypography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.72)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.md,
    padding: authSpacing.lg,
  },
  timelineDot: {
    backgroundColor: authColors.gold,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '900',
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    marginTop: authSpacing.xs,
  },
  time: {
    color: 'rgba(245, 245, 245, 0.42)',
    fontSize: authTypography.tiny,
    marginTop: authSpacing.xs,
  },
  amount: {
    color: authColors.accentGreen,
    fontSize: authTypography.body,
    fontWeight: '900',
  },
});
