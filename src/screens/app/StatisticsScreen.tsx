import { BarChart3, Crown, ReceiptText, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { RecentGameCard } from '../../components/dashboard/RecentGameCard';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { AppText } from '../../components/ui/AppText';
import { useGameOverview } from '../../hooks/useGameOverview';
import { useOverviewNavigation } from '../../hooks/useOverviewNavigation';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { formatOverviewMoney } from '../../utils/gameOverview';

export function StatisticsScreen() {
  const [roundLimit, setRoundLimit] = useState(20);
  const [playerLimit, setPlayerLimit] = useState(20);
  const overview = useGameOverview();
  const { openTarget, openTables } = useOverviewNavigation();
  const stats = [
    {
      label: 'Gespielte Runden',
      value: String(overview.rounds.length),
      icon: Trophy,
    },
    {
      label: 'Spielwerte gesamt',
      value: formatOverviewMoney(overview.roundValueCents),
      icon: BarChart3,
    },
    { label: 'Häufigster Spieltyp', value: overview.favoriteType, icon: Crown },
    {
      label: 'Zahlungen offen',
      value: formatOverviewMoney(overview.openPaymentCents),
      icon: ReceiptText,
    },
  ];
  const recent = overview.rounds.slice(0, 7).reverse();
  const maxAmount = Math.max(1, ...recent.map((round) => round.amountCents));
  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>Statistik</AppText>
        <AppText style={styles.title}>Deine Spielstatistik</AppText>
        <AppText style={styles.subtitle}>
          Aktive und archivierte Runden, ohne doppelte Zählung. Ältere lokale
          Spieltage sind ebenfalls enthalten.
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
        <AppText style={styles.chartCopy}>
          Spielwerte entsprechen den eingetragenen Gesamtgewinnen der Gewinner.
          Offene Zahlungen stammen ausschließlich aus abgeschlossenen Tischen.
        </AppText>
        {!overview.rounds.length ? (
          <View style={{ marginTop: authSpacing.xl }}>
            <EmptyGameState
              icon={BarChart3}
              title="Noch keine Statistik"
              message="Trage dein erstes Spiel ein. Danach siehst du hier echte Ergebnisse und Bilanzen."
            />
            <Pressable
              accessibilityRole="button"
              onPress={openTables}
              style={{ minHeight: 48, justifyContent: 'center' }}
            >
              <AppText style={styles.kicker}>Zu deinen Tischen</AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <SectionHeader title="Spielwerte der letzten Runden" />
            <View style={styles.chartCard}>
              <View
                style={styles.chartBars}
                accessible
                accessibilityRole="image"
                accessibilityLabel={recent
                  .map(
                    (round, index) =>
                      `Runde ${index + 1}: ${formatOverviewMoney(round.amountCents)}`,
                  )
                  .join(', ')}
              >
                {recent.map((round) => (
                  <View key={round.id} style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(2, (round.amountCents / maxAmount) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <AppText style={styles.chartCopy}>
                Älteste Runde links, neueste rechts. Jeder Balken zeigt den
                eingetragenen Spielwert.
              </AppText>
            </View>
            <SectionHeader title="Spielerbilanz je Tisch" />
            <AppText style={styles.chartCopy}>
              Gewinnrate = gewonnene / beteiligte Runden. Gleichnamige lokale
              Spieler verschiedener Tische werden nicht zusammengelegt.
            </AppText>
            {overview.playerStats.slice(0, playerLimit).map((player) => (
              <Pressable
                key={player.id}
                accessibilityRole="button"
                accessibilityLabel={`${player.name}, ${player.tableName}, Bilanz ${formatOverviewMoney(player.balanceCents)}, öffnen`}
                onPress={() => openTarget(player.target)}
                style={styles.chartCard}
              >
                <AppText style={styles.cardValue}>
                  {player.name} · {formatOverviewMoney(player.balanceCents)}
                </AppText>
                <AppText style={styles.cardLabel}>{player.tableName}</AppText>
                <AppText style={styles.chartCopy}>
                  {player.rounds} beteiligt · {player.wins} gewonnen ·{' '}
                  {player.losses} verloren ·{' '}
                  {Math.round((player.wins / player.rounds) * 100)} % Gewinnrate
                </AppText>
              </Pressable>
            ))}
            {overview.playerStats.length > playerLimit ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPlayerLimit((limit) => limit + 20)}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <AppText style={styles.kicker}>
                  Weitere Spielerbilanzen anzeigen
                </AppText>
              </Pressable>
            ) : null}
            <SectionHeader title="Alle gespeicherten Runden" />
            {overview.rounds.slice(0, roundLimit).map((round) => (
              <View key={round.id} style={{ marginBottom: authSpacing.md }}>
                <RecentGameCard
                  gameType={round.gameType}
                  date={new Date(round.createdAt).toLocaleString('de-DE')}
                  amount={formatOverviewMoney(round.amountCents)}
                  players={round.participants}
                  winner={round.winnerName}
                  tableName={round.tableName}
                  onPress={() => openTarget(round.target)}
                />
              </View>
            ))}
            {overview.rounds.length > roundLimit ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setRoundLimit((limit) => limit + 20)}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <AppText style={styles.kicker}>Weitere Runden anzeigen</AppText>
              </Pressable>
            ) : null}
          </>
        )}
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
    minWidth: '46%',
    flexBasis: '46%',
    flexGrow: 1,
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
  chartCard: {
    backgroundColor: 'rgba(13, 27, 19, 0.76)',
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: authRadius.xl,
    borderWidth: 1,
    padding: authSpacing.xl,
    marginBottom: authSpacing.md,
  },
  chartBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: authSpacing.md,
    height: 120,
    justifyContent: 'space-around',
  },
  barTrack: {
    backgroundColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: authRadius.pill,
    flex: 1,
    maxWidth: 36,
    height: '100%',
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
