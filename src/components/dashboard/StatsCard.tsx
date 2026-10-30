import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authShadows } from '../../theme/shadows';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type StatItem = {
  label: string;
  value: string;
  tone?: 'gold' | 'green' | 'red';
};

type StatsCardProps = {
  title: string;
  subtitle: string;
  stats: StatItem[];
};

export function StatsCard({ title, subtitle, stats }: StatsCardProps) {
  return (
    <LinearGradient
      colors={['rgba(212, 175, 55, 0.28)', 'rgba(13, 27, 19, 0.94)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <View>
          <AppText style={styles.title}>{title}</AppText>
          <AppText style={styles.subtitle}>{subtitle}</AppText>
        </View>
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>Heute</AppText>
        </View>
      </View>

      <View style={styles.grid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statBox}>
            <AppText style={[styles.statValue, styles[stat.tone ?? 'gold']]}>
              {stat.value}
            </AppText>
            <AppText style={styles.statLabel}>{stat.label}</AppText>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    ...authShadows.gold,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    padding: authSpacing.xl,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.subtitle,
    fontWeight: '900',
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    marginTop: authSpacing.xs,
  },
  badge: {
    backgroundColor: 'rgba(242, 201, 76, 0.14)',
    borderColor: 'rgba(242, 201, 76, 0.28)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.xs,
  },
  badgeText: {
    color: authColors.goldHighlight,
    fontSize: authTypography.tiny,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.md,
    marginTop: authSpacing.xl,
  },
  statBox: {
    backgroundColor: 'rgba(7, 17, 11, 0.42)',
    borderRadius: authRadius.lg,
    minWidth: '46%',
    padding: authSpacing.md,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: authColors.textSecondary,
    fontSize: authTypography.tiny,
    fontWeight: '700',
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
