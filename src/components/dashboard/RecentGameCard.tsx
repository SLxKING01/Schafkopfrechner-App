import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type RecentGameCardProps = {
  gameType: string;
  date: string;
  amount: string;
  players: number;
  result: 'win' | 'loss';
};

export function RecentGameCard({
  gameType,
  date,
  amount,
  players,
  result,
}: RecentGameCardProps) {
  const isWin = result === 'win';

  return (
    <View style={styles.card}>
      <View>
        <AppText style={styles.title}>{gameType}</AppText>
        <AppText style={styles.meta}>
          {date} · {players} Spieler
        </AppText>
      </View>
      <AppText style={[styles.amount, isWin ? styles.win : styles.loss]}>
        {isWin ? '+' : '-'}
        {amount}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.74)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: authSpacing.lg,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '800',
  },
  meta: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    marginTop: authSpacing.xs,
  },
  amount: {
    fontSize: authTypography.body,
    fontWeight: '900',
  },
  win: {
    color: authColors.accentGreen,
  },
  loss: {
    color: '#D65A5A',
  },
});
