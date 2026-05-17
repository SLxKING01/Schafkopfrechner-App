import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, Text, type TextStyle } from 'react-native';

import { theme } from '../../constants/theme';

type AppTextVariant = 'title' | 'subtitle' | 'body' | 'caption';

type AppTextProps = {
  children: ReactNode;
  variant?: AppTextVariant;
  style?: StyleProp<TextStyle>;
};

export function AppText({ children, variant = 'body', style }: AppTextProps) {
  return <Text style={[styles.base, styles[variant], style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  base: {
    color: theme.colors.text,
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '600',
  },
  body: {
    fontSize: theme.typography.body,
  },
  caption: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
});
