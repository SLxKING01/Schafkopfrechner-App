import { StyleSheet, View } from 'react-native';

import { theme } from '../constants/theme';
import { AppButton } from './ui/AppButton';
import { AppCard } from './ui/AppCard';
import { AppText } from './ui/AppText';

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.copy}>
        <AppText variant="subtitle">{title}</AppText>
        <AppText variant="caption">{message}</AppText>
      </View>
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.lg,
  },
  copy: {
    gap: theme.spacing.xs,
  },
});
