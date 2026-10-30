import { StyleSheet, View } from 'react-native';

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
};

export function MatchHistoryCard({
  winner,
  losers,
  amount,
  time,
  gameType,
}: MatchHistoryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.timelineDot} />
      <View style={styles.copy}>
        <AppText style={styles.title}>{winner} gewinnt</AppText>
        <AppText style={styles.subtitle}>
          {gameType} · gegen {losers}
        </AppText>
        <AppText style={styles.time}>{time}</AppText>
      </View>
      <AppText style={styles.amount}>+{amount}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
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
