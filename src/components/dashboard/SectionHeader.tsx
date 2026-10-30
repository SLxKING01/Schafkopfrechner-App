import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type SectionHeaderProps = {
  title: string;
  action?: string;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText style={styles.title}>{title}</AppText>
      {action ? <AppText style={styles.action}>{action}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: authSpacing.md,
    marginTop: authSpacing.xl,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.subtitle,
    fontWeight: '800',
  },
  action: {
    color: authColors.goldHighlight,
    fontSize: authTypography.caption,
    fontWeight: '800',
  },
});
