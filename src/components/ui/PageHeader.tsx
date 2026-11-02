import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { authControlSizes, authSpacing } from '../../theme/spacing';
import { AppText } from './AppText';

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <AppText
          accessibilityRole="header"
          variant="pageTitle"
          style={styles.title}
        >
          {title}
        </AppText>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: authSpacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: authControlSizes.field,
    gap: authSpacing.md,
  },
  title: { flex: 1, minWidth: 0 },
});
