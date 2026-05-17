import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { theme } from '../../constants/theme';
import { AppText } from './AppText';

type AppSectionProps = {
  title: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppSection({ title, children, style }: AppSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <AppText variant="subtitle">{title}</AppText>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.md,
  },
  content: {
    gap: theme.spacing.sm,
  },
});
