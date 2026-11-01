import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  authColors as c,
  authControlSizes,
  authInteraction,
  authSpacing as space,
  authTextStyles,
} from '../../theme';
import { formatOverviewMoney } from '../../utils/gameOverview';
import { AppText } from '../ui/AppText';

export function DashboardTotals({
  balance,
  count,
  wins,
  known,
  onPress,
  caption,
}: {
  balance: number;
  count: number;
  wins: number;
  known: boolean;
  onPress: () => void;
  caption: string;
}) {
  const { width, fontScale } = useWindowDimensions();
  const expanded = fontScale >= 1.3;
  const values = [
    {
      label: 'Gesamtbilanz',
      value: known
        ? `${balance > 0 ? '+' : ''}${formatOverviewMoney(balance)}`
        : '–',
    },
    {
      label: 'Spiele gesamt',
      value: known ? String(count) : '–',
    },
    {
      label: 'Gewinnquote',
      value:
        known && count
          ? `${((wins / count) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })}\u00a0%`
          : '–',
    },
  ];
  const balanceItem = values[0];
  return (
    <View>
      <View style={s.heroWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Gesamtbilanz: ${balanceItem.value}`}
          accessibilityHint="Öffnet die Statistik. Spielergebnisse ohne Stock und Zahlungen."
          onPress={onPress}
          style={({ pressed }) => [s.hero, pressed && authInteraction.pressed]}
        >
          <AppText style={s.heroLabel}>Gesamtbilanz</AppText>
          <AppText style={[s.heroValue, width < 350 && s.narrowHero]}>
            {balanceItem.value}
          </AppText>
          <AppText style={s.label}>{caption}</AppText>
        </Pressable>
      </View>
      <View style={[s.strip, expanded && s.expanded]}>
        {values.slice(1).map((item, i) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}: ${item.value}`}
            accessibilityHint="Öffnet die Statistik. Spielergebnisse ohne Stock und Zahlungen."
            onPress={onPress}
            style={({ pressed }) => [
              s.item,
              !expanded && i > 0 && s.separator,
              expanded && s.expandedItem,
              pressed && authInteraction.pressed,
            ]}
          >
            <AppText style={s.value}>{item.value}</AppText>
            <AppText style={s.label}>{item.label}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  heroWrap: { position: 'relative' },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  heroLabel: { ...authTextStyles.subhead, color: c.textSecondary },
  heroValue: {
    ...authTextStyles.balanceHero,
    color: c.textPrimary,
    textAlign: 'center',
    flexShrink: 1,
  },
  narrowHero: { fontSize: authTextStyles.balanceHeroCompact.fontSize },
  strip: {
    flexDirection: 'row',
    paddingTop: space.xxl,
    paddingBottom: space.xl,
  },
  expanded: { flexDirection: 'column' },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: space.xs,
    gap: space.xs,
    minHeight: authControlSizes.touch,
  },
  separator: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.borderSoft,
  },
  expandedItem: {
    flex: 0,
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  value: { ...authTextStyles.metric },
  label: { ...authTextStyles.caption, textAlign: 'center' },
});
