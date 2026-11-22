import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { authColors, authInteraction } from '../../theme';
import { authControlSizes, authSpacing } from '../../theme/spacing';
import { AppText } from './AppText';

/** Round icon button used for "Zurück", "Schließen" and similar header actions. */
export function RoundIconButton({
  accessibilityLabel,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        pressed && authInteraction.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function PageHeader({
  title,
  action,
  onBack,
  kicker,
  subtitle,
}: {
  title: string;
  action?: ReactNode;
  /** Shows a round back button left of the title. */
  onBack?: () => void;
  kicker?: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {onBack ? (
          <RoundIconButton accessibilityLabel="Zurück" onPress={onBack}>
            <ArrowLeft
              color={authColors.goldHighlight}
              size={20}
              strokeWidth={2.4}
            />
          </RoundIconButton>
        ) : null}
        <View style={styles.titleBlock}>
          {kicker ? <AppText style={styles.kicker}>{kicker}</AppText> : null}
          <AppText
            accessibilityRole="header"
            variant="pageTitle"
            style={styles.title}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText style={styles.subtitle}>{subtitle}</AppText>
          ) : null}
        </View>
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
  titleBlock: { flex: 1, minWidth: 0 },
  title: { minWidth: 0 },
  kicker: {
    color: authColors.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: { color: authColors.textMutedGreen, fontSize: 14, marginTop: 2 },
  round: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderColor: authColors.borderGold,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
