import { BarChart3, Crown, TrendingUp, Trophy } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { AppText } from '../../components/ui/AppText';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { winningIds } from '../../utils/winningParty';

export function StatisticsScreen() {
  const players = useGameStore((state) => state.players);
  const rounds = useGameStore((state) => state.rounds);
  const archive = useGameStore((state) => state.archivedTables);
  const allRounds = [...archive.flatMap((entry) => entry.rounds), ...rounds];
  const total = allRounds.reduce((sum, round) => sum + round.amount, 0);
  const format = (amount: number) => `${amount.toFixed(2).replace('.', ',')} €`;
  const stats = [
    { label: 'Erfasste Runden', value: `${allRounds.length}`, icon: Trophy },
    {
      label: 'Aktueller Tisch',
      value: `${rounds.length} Runden`,
      icon: TrendingUp,
    },
    { label: 'Archivierte Tische', value: `${archive.length}`, icon: Crown },
    { label: 'Gesamtumsatz', value: format(total), icon: BarChart3 },
  ];
  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>Statistik</AppText>
        <AppText style={styles.title}>Spielübersicht</AppText>
        <AppText style={styles.subtitle}>
          Aus den auf diesem Gerät gespeicherten Tischen und Runden.
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
              </Animated.View>
            );
          })}
        </View>

        <SectionHeader title="Spieler am aktuellen Tisch" />
        {players.map((player) => {
          const wins = rounds.filter((round) =>
            winningIds(round).includes(player.id),
          ).length;
          const losses = rounds.filter((round) =>
            round.loserIds.includes(player.id),
          ).length;
          return (
            <AppText
              key={player.id}
              style={{ color: authColors.textPrimary, marginTop: 12 }}
            >
              {player.name}: {wins} Siege / {losses} Niederlagen
            </AppText>
          );
        })}
        <SectionHeader title="Datenbasis" />
        <AppText style={styles.chartCopy}>
          {allRounds.length === 0
            ? 'Noch keine Spiele erfasst.'
            : 'Diese Übersicht enthält lokale Daten. Eine persönliche Gewinnrate wird erst angezeigt, wenn dein Profil eindeutig einem Spieler zugeordnet ist.'}
        </AppText>
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
