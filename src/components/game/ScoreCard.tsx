import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type ScoreCardProps = {
  label: string;
  value: string;
  tone?: 'gold' | 'green' | 'red';
};

export function ScoreCard({ label, value, tone = 'gold' }: ScoreCardProps) {
  return (
    <View style={styles.card}>
      <AppText style={[styles.value, styles[tone]]}>{value}</AppText>
      <AppText style={styles.label}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(13, 27, 19, 0.76)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    flex: 1,
    padding: authSpacing.md,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
  },
  label: {
    color: authColors.textSecondary,
    fontSize: authTypography.tiny,
    fontWeight: '800',
    marginTop: authSpacing.xs,
  },
  gold: {
    color: authColors.goldHighlight,
  },
  green: {
    color: authColors.accentGreen,
  },
  red: {
    color: '#D65A5A',
  },
});
