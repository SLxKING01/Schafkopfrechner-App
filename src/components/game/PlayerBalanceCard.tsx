import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type PlayerBalanceCardProps = {
  name: string;
  amount: string;
  positive: boolean;
};

export function PlayerBalanceCard({
  name,
  amount,
  positive,
}: PlayerBalanceCardProps) {
  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
      <View>
        <AppText style={styles.name}>{name}</AppText>
        <AppText style={styles.label}>Kontostand</AppText>
      </View>
      <AppText
        style={[styles.amount, positive ? styles.positive : styles.negative]}
      >
        {amount}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.76)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: authSpacing.md,
  },
  name: {
    color: authColors.textPrimary,
    fontSize: authTypography.caption,
    fontWeight: '900',
  },
  label: {
    color: authColors.textSecondary,
    fontSize: authTypography.tiny,
    marginTop: authSpacing.xs,
  },
  amount: {
    fontSize: authTypography.body,
    fontWeight: '900',
  },
  positive: {
    color: authColors.accentGreen,
  },
  negative: {
    color: '#D65A5A',
  },
});
