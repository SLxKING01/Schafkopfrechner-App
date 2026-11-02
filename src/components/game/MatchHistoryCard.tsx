import { Pressable, StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type MatchHistoryCardProps = {
  displayGameType?: string;
  stockMovement?: string;
  participation?: string;
  winner: string;
  losers: string;
  amount: string;
  time: string;
  gameType: string;
  stockDeposit?: boolean;
  stockBooking?: string;
  details?: string;
  customAmounts?: { name: string; amount: number }[];
  compact?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function MatchHistoryCard({
  displayGameType,
  stockMovement,
  participation,
  winner,
  losers,
  amount,
  time,
  gameType,
  stockDeposit,
  stockBooking,
  details,
  customAmounts,
  compact = false,
  onPress,
  accessibilityLabel,
}: MatchHistoryCardProps) {
  if (compact && customAmounts) {
    const label = `Eigenes Spiel, ${customAmounts.map((p) => `${p.name}: ${p.amount.toFixed(2).replace('.', ',')} Euro`).join(', ')}, ${time}`;
    const content = (
      <>
        <View style={styles.customHeading}>
          <View style={styles.gameColumn}>
            <AppText style={styles.tableTitle}>Eigenes Spiel</AppText>
            <AppText style={styles.tableTime}>{time}</AppText>
          </View>
          <AppText style={styles.tableTime}>{amount} verteilt</AppText>
        </View>
        {customAmounts.map((entry, index) => (
          <View key={index} style={styles.customLine}>
            <AppText style={[styles.tableWinner, styles.customName]}>
              {entry.name}
            </AppText>
            <AppText style={styles.customMoney}>
              {entry.amount > 0 ? '+' : ''}
              {entry.amount.toFixed(2).replace('.', ',')} €
            </AppText>
          </View>
        ))}
      </>
    );
    return onPress ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={`${label}. Öffnet die Beträge zum Bearbeiten.`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.customRow,
          pressed && styles.tablePressed,
        ]}
      >
        {content}
      </Pressable>
    ) : (
      <View accessible accessibilityLabel={label} style={styles.customRow}>
        {content}
      </View>
    );
  }
  if (compact) {
    const booking = !!stockBooking || !!stockDeposit;
    const heading =
      stockBooking ??
      (stockDeposit ? 'Alle weiter' : (displayGameType ?? gameType));
    const label = `${gameType}, ${stockBooking ?? (stockDeposit ? 'Stock eingezahlt' : `Gewinner ${winner}, gegen ${losers}`)}, ${amount}, ${time}${details ? `, ${details}` : ''}${stockMovement ? `, ${stockMovement}` : ''}`;
    const content = (
      <>
        <View style={styles.entryHeading}>
          <View style={styles.headingCopy}>
            <AppText numberOfLines={2} style={styles.entryTitle}>
              {heading}
            </AppText>
            <AppText style={styles.entryTime}>{time}</AppText>
          </View>
          <View style={styles.resultCopy}>
            <AppText numberOfLines={2} style={styles.entryResult}>
              {booking ? (stockDeposit ? 'Vier Spieler' : losers) : winner}
            </AppText>
            {!booking && details ? (
              <AppText numberOfLines={1} style={styles.entryNote}>
                {details.split(' · Partner:')[0].replace('Ansager:', 'Ans.')}
              </AppText>
            ) : null}
          </View>
          <AppText
            style={[styles.entryAmount, booking && styles.bookingAmount]}
          >
            {booking ? '' : '+'}
            {amount}
          </AppText>
        </View>
        {stockMovement ? (
          <AppText style={styles.stockText}>
            {stockMovement
              .replace('Stock verdoppelt:', 'Stock ×2:')
              .replace('Stock ausgezahlt:', 'Stock:')}
          </AppText>
        ) : null}
      </>
    );
    return onPress ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={`${label}. Öffnet die Spielkonfiguration zum Bearbeiten.`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.historyCard,
          pressed && styles.tablePressed,
        ]}
      >
        {content}
      </Pressable>
    ) : (
      <View accessible accessibilityLabel={label} style={styles.historyCard}>
        {content}
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.timelineDot} />
      <View style={styles.copy}>
        <AppText style={styles.title}>
          {customAmounts
            ? 'Eigenes Spiel'
            : (stockBooking ??
              (stockDeposit ? 'Stock eingezahlt' : `${winner} gewinnt`))}
        </AppText>
        {customAmounts ? (
          customAmounts.map((entry, index) => (
            <AppText key={index} style={styles.subtitle}>
              {entry.name}: {entry.amount > 0 ? '+' : ''}
              {entry.amount.toFixed(2).replace('.', ',')} €
            </AppText>
          ))
        ) : (
          <AppText style={styles.subtitle}>
            {stockDeposit || stockBooking
              ? `Alle vier · ${losers}`
              : `${gameType} · gegen ${losers}`}
          </AppText>
        )}
        {stockMovement ? (
          <AppText style={styles.subtitle}>{stockMovement}</AppText>
        ) : null}
        {participation ? (
          <AppText style={styles.subtitle}>{participation}</AppText>
        ) : null}
        {details ? <AppText style={styles.subtitle}>{details}</AppText> : null}
        <AppText style={styles.time}>{time}</AppText>
      </View>
      <AppText style={styles.amount}>
        {customAmounts ? '' : '+'}
        {amount}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  customRow: {
    gap: authSpacing.sm,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.md,
    backgroundColor: authColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: authColors.borderSoft,
  },
  customHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: authSpacing.sm,
  },
  customLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: authSpacing.sm,
  },
  customName: { flex: 1, minWidth: 0 },
  customMoney: {
    color: authColors.textPrimary,
    fontSize: authTypography.caption,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },

  historyCard: {
    gap: 3,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
    backgroundColor: authColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: authColors.borderSoft,
  },
  entryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    minHeight: 40,
  },
  headingCopy: { width: 72, minWidth: 0 },
  entryTitle: {
    color: authColors.textPrimary,
    fontSize: authTypography.caption,
    fontWeight: '600',
  },
  entryTime: { color: authColors.textSecondary, fontSize: 10, marginTop: 2 },
  entryAmount: {
    width: 72,
    textAlign: 'right',
    color: authColors.accentGreen,
    fontSize: authTypography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bookingAmount: { color: authColors.goldHighlight },
  resultCopy: { flex: 1, minWidth: 0, gap: 2 },
  entryResult: {
    color: authColors.textPrimary,
    fontSize: authTypography.caption,
    fontWeight: '500',
    lineHeight: 17,
  },
  entryNote: { color: authColors.textSecondary, fontSize: 10, lineHeight: 14 },
  stockText: {
    color: authColors.textSecondary,
    fontSize: authTypography.tiny,
    lineHeight: 16,
  },
  tablePressed: { backgroundColor: authColors.control },
  gameColumn: { flex: 1.1, minWidth: 0 },
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
