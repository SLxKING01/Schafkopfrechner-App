import type { LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type EmptyGameStateProps = {
  icon: ComponentType<LucideProps>;
  title: string;
  message: string;
};

export function EmptyGameState({
  icon: Icon,
  title,
  message,
}: EmptyGameStateProps) {
  return (
    <View style={styles.card}>
      <Icon color={authColors.goldHighlight} size={28} strokeWidth={2} />
      <AppText style={styles.title}>{title}</AppText>
      <AppText style={styles.message}>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.7)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    padding: authSpacing.xl,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '900',
    marginTop: authSpacing.md,
  },
  message: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    lineHeight: 19,
    marginTop: authSpacing.xs,
    textAlign: 'center',
  },
});
