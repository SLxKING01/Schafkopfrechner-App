import { BarChart3, Crown, TrendingUp, Trophy } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { AppText } from '../../components/ui/AppText';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';

const stats = [
  { label: 'Gesamtspiele', value: '128', icon: Trophy, progress: 0.82 },
  { label: 'Gewinnrate', value: '61,4 %', icon: TrendingUp, progress: 0.61 },
  { label: 'Bestes Spiel', value: 'Solo', icon: Crown, progress: 0.74 },
  {
    label: 'Ø Gewinn',
    value: '+7,80 €',
    icon: BarChart3,
    progress: 0.68,
  },
];

export function StatisticsScreen() {
  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>Statistik</AppText>
        <AppText style={styles.title}>Deine Performance</AppText>
        <AppText style={styles.subtitle}>
          Verdichtete Spielanalyse für schnelle Entscheidungen am Tisch.
        </AppText>

        <View style={styles.grid}>
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <Animated.View
                key={stat.label}
                entering={FadeInDown.duration(420).delay(index * 70)}
                style={styles.card}
              >
                <Icon color={authColors.goldHighlight} size={22} />
                <AppText style={styles.cardValue}>{stat.value}</AppText>
                <AppText style={styles.cardLabel}>{stat.label}</AppText>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${stat.progress * 100}%` },
                    ]}
                  />
                </View>
              </Animated.View>
            );
          })}
        </View>

        <SectionHeader title="Letzte Performance" />
        <View style={styles.chartCard}>
          <View style={styles.chartBars}>
            {[44, 72, 38, 84, 58, 92, 66].map((height, index) => (
              <View key={`${height}-${index}`} style={styles.barTrack}>
                <View style={[styles.barFill, { height }]} />
              </View>
            ))}
          </View>
          <AppText style={styles.chartCopy}>
            Mini-Chart Platzhalter für echte Supabase Spielhistorie.
          </AppText>
        </View>
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.xl,
  },
  kicker: {
    color: authColors.goldHighlight,
    fontSize: authTypography.caption,
    fontWeight: '900',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.hero,
    fontWeight: '900',
    marginTop: authSpacing.sm,
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.body,
    lineHeight: 23,
    marginTop: authSpacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.md,
    marginTop: authSpacing.xxl,
  },
  card: {
    backgroundColor: 'rgba(13, 27, 19, 0.78)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    minWidth: '47%',
    padding: authSpacing.lg,
  },
  cardValue: {
    color: authColors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginTop: authSpacing.lg,
  },
  cardLabel: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    marginTop: authSpacing.xs,
  },
  progressTrack: {
    backgroundColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: authRadius.pill,
    height: 7,
    marginTop: authSpacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: authColors.gold,
    borderRadius: authRadius.pill,
    height: '100%',
  },
  chartCard: {
    backgroundColor: 'rgba(13, 27, 19, 0.76)',
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: authRadius.xl,
    borderWidth: 1,
    padding: authSpacing.xl,
  },
  chartBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: authSpacing.md,
    height: 120,
  },
  barTrack: {
    backgroundColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: authRadius.pill,
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: authColors.accentGreen,
    borderRadius: authRadius.pill,
  },
  chartCopy: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    marginTop: authSpacing.lg,
  },
});
