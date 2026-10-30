import { Pressable, StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type RecentGameCardProps = {
  gameType: string;
  date: string;
  amount: string;
  players: number;
  winner: string;
  tableName: string;
  onPress: () => void;
};

export function RecentGameCard({
  gameType,
  date,
  amount,
  players,
  winner,
  tableName,
  onPress,
}: RecentGameCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${gameType}, ${winner} gewinnt ${amount}, ${tableName} öffnen`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={styles.title}>{gameType}</AppText>
        <AppText style={styles.meta}>
          {date} · {players} Beteiligte
        </AppText>
        <AppText style={styles.meta}>
          {winner} gewinnt · {tableName}
        </AppText>
      </View>
      <AppText style={[styles.amount, styles.win]}>+{amount}</AppText>
    </Pressable>
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
    gap: authSpacing.md,
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
