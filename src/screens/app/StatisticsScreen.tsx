import { BarChart3 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import {
  average,
  BonusStatistics,
  GameTypeStatistics,
  Metric,
  money,
  rate,
  StatAction,
  StatHeading,
  StatNote,
  StatPanel,
  TableStatisticsPanel,
} from '../../components/statistics/StatisticsPanels';
import { AppText } from '../../components/ui/AppText';
import { useGameOverview } from '../../hooks/useGameOverview';
import { useOverviewNavigation } from '../../hooks/useOverviewNavigation';
import { useAuthStore } from '../../store/authStore';
import { useDashboardIdentityStore } from '../../store/dashboardIdentityStore';
import { authColors, authSpacing, authTextStyles } from '../../theme';
import { dashboardPersonal } from '../../utils/dashboardPersonal';
import { formatOverviewMoney } from '../../utils/gameOverview';
import {
  type StatisticsSubject,
  statisticsSubjects,
  subjectEntries,
  summarizeStatistics,
} from '../../utils/statistics';

const noSelections: Record<string, string> = {};

export function StatisticsScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const selections = useDashboardIdentityStore((s) => s.selections);
  const identityReady = useDashboardIdentityStore((s) => s.hydrated);
  const overview = useGameOverview();
  const { openTables, openStatisticsRound, openTableStatistics } =
    useOverviewNavigation();
  const [mode, setMode] = useState<'all' | 'player' | 'table'>('all');
  const [subjectId, setSubjectId] = useState('');
  const [tableId, setTableId] = useState('');
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const tables = overview.statisticsTables;
  const selected =
    selections[userId ? `account:${userId}` : 'guest'] ?? noSelections;
  const assigned = useMemo(
    () => dashboardPersonal(tables, selected, userId),
    [tables, selected, userId],
  );
  const subjects = useMemo(() => {
    const all = statisticsSubjects(tables);
    if (!identityReady || !assigned.hasIdentity) return all;
    const memberships = [...assigned.memberships].map(
      ([tableId, playerId]) => ({ tableId, playerId }),
    );
    const mine: StatisticsSubject = {
      id: 'dashboard-personal',
      name: 'Meine Gesamtstatistik',
      context: `${memberships.length} ${memberships.length === 1 ? 'zugeordneter Tisch' : 'zugeordnete Tische'}`,
      memberships,
    };
    return [
      mine,
      ...all.filter(
        (s) =>
          s.memberships.length !== memberships.length ||
          !s.memberships.every(
            (m) => assigned.memberships.get(m.tableId) === m.playerId,
          ),
      ),
    ];
  }, [tables, assigned, identityReady]);
  const subject = subjects.find((p) => p.id === subjectId) ?? subjects[0];
  const table =
    tables.find((t) => t.id === tableId) ??
    tables.find((t) => t.target.kind === 'active') ??
    tables[0];
  const entries = useMemo(
    () =>
      subjectEntries(tables, mode === 'player' ? subject : undefined).filter(
        (e) =>
          period === 'all' ||
          Date.parse(e.round.createdAt) >= overview.asOf - 30 * 86400000,
      ),
    [tables, subject, mode, period, overview.asOf],
  );
  const summary = useMemo(() => summarizeStatistics(entries), [entries]);
  const personal = mode === 'player';
  return (
    <AuthBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText accessibilityRole="header" style={styles.title}>
          Statistik
        </AppText>
        <StatNote>
          Spielarten, Kartenfarben und der Verlauf deiner Tische.
        </StatNote>
        <View style={styles.inline}>
          <StatAction selected={mode === 'all'} onPress={() => setMode('all')}>
            Gesamt
          </StatAction>
          <StatAction selected={personal} onPress={() => setMode('player')}>
            Spieler
          </StatAction>
          <StatAction
            selected={mode === 'table'}
            onPress={() => setMode('table')}
          >
            Tisch
          </StatAction>
        </View>
        {!overview.rounds.length ? (
          <>
            <EmptyGameState
              icon={BarChart3}
              title="Noch keine Statistik"
              message="Trage dein erstes Spiel ein. Danach siehst du hier echte Ergebnisse und Bilanzen."
            />
            <StatAction onPress={openTables}>Zu deinen Tischen</StatAction>
          </>
        ) : (
          <>
            {mode === 'table' ? (
              <>
                <StatNote>
                  Tisch auswählen · immer der vollständige Verlauf
                </StatNote>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.inline}
                >
                  {tables.map((t) => (
                    <StatAction
                      key={t.id}
                      selected={t.id === table?.id}
                      onPress={() => setTableId(t.id)}
                    >
                      {t.name}
                    </StatAction>
                  ))}
                </ScrollView>
                {table ? (
                  <>
                    <StatAction onPress={() => openTableStatistics(table.id)}>
                      Tischstatistik separat öffnen
                    </StatAction>
                    <TableStatisticsPanel
                      key={table.id}
                      table={table}
                      onOpen={(r) => openStatisticsRound(table, r)}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.inline}>
                  <StatAction
                    selected={period === 'all'}
                    onPress={() => setPeriod('all')}
                  >
                    Gesamter Zeitraum
                  </StatAction>
                  <StatAction
                    selected={period === 'month'}
                    onPress={() => setPeriod('month')}
                  >
                    Letzte 30 Tage
                  </StatAction>
                </View>
                {personal ? (
                  <>
                    <StatHeading>Spieler auswählen</StatHeading>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.inline}
                    >
                      {subjects.map((p) => (
                        <StatAction
                          key={p.id}
                          selected={subject?.id === p.id}
                          onPress={() => setSubjectId(p.id)}
                        >
                          {p.name} · {p.context}
                        </StatAction>
                      ))}
                    </ScrollView>
                    <StatNote>
                      Gleichnamige lokale Spieler bleiben getrennt. Nur
                      verknüpfte Konten oder ausdrücklich zugeordnete
                      Tischspieler werden zusammengefasst.
                    </StatNote>
                  </>
                ) : null}
                {!entries.length ? (
                  <StatPanel>
                    <StatHeading>
                      Keine Runden im gewählten Zeitraum
                    </StatHeading>
                    <StatAction onPress={() => setPeriod('all')}>
                      Gesamten Zeitraum anzeigen
                    </StatAction>
                  </StatPanel>
                ) : (
                  <>
                    <View style={styles.grid}>
                      {personal ? (
                        <>
                          <Metric
                            label="Spielbilanz"
                            value={money(summary.balance)}
                            tone={
                              summary.balance < 0
                                ? 'negative'
                                : summary.balance > 0
                                  ? 'positive'
                                  : undefined
                            }
                            detail="Ohne Stock und Zahlungen"
                          />
                          <Metric
                            label="Gewinnquote"
                            value={rate(summary.wins, summary.count)}
                            detail={`${summary.wins}/${summary.count} beteiligte Runden`}
                          />
                          <Metric
                            label="Selbst angesagt"
                            value={rate(summary.ownWins, summary.own)}
                            detail={`${summary.ownWins}/${summary.own} gewonnen`}
                          />
                          <Metric
                            label="Ø je Runde"
                            value={average(summary.balance, summary.count)}
                            tone={
                              summary.balance < 0
                                ? 'negative'
                                : summary.balance > 0
                                  ? 'positive'
                                  : undefined
                            }
                            detail={`${summary.count} Runden`}
                          />
                        </>
                      ) : (
                        <>
                          <Metric
                            label="Gespielte Runden"
                            value={String(summary.count)}
                            detail={`${new Set(entries.map((e) => e.round.tableKey)).size} Tische / Spieltage`}
                          />
                          <Metric
                            label="Spielwerte gesamt"
                            value={formatOverviewMoney(summary.value)}
                            detail="Gewinnerpartei, ohne Stock"
                          />
                          <Metric
                            label="Ansagende Partei gewinnt"
                            value={rate(summary.wins, summary.knownResults)}
                            detail={`${summary.wins}/${summary.knownResults} auswertbare Runden`}
                          />
                          <Metric
                            label="Ø Spielwert"
                            value={formatOverviewMoney(
                              Math.round(summary.value / summary.count),
                            )}
                            detail="Gesamtgewinn je Runde"
                          />
                        </>
                      )}
                    </View>
                    <StatNote>
                      {summary.knownDeclarers}/{summary.count} Runden mit
                      bekanntem Ansager. Fehlende historische Angaben gelten als
                      unbekannt. Kleine Stichproben sind keine Bewertung der
                      Spielstärke.
                    </StatNote>
                    <GameTypeStatistics
                      entries={entries}
                      personal={personal}
                      onOpen={(r) => {
                        const t = tables.find((t) => t.id === r.tableKey);
                        if (t) openStatisticsRound(t, r);
                      }}
                    />
                    <BonusStatistics entries={entries} />
                    {personal ? (
                      <StatPanel>
                        <StatHeading>Einzelne Ausschläge</StatHeading>
                        <StatNote>
                          Größter Gewinn:{' '}
                          {money(Math.max(0, summary.best ?? 0))}
                        </StatNote>
                        <StatNote>
                          Größter Verlust:{' '}
                          {money(Math.min(0, summary.worst ?? 0))}
                        </StatNote>
                      </StatPanel>
                    ) : null}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </AuthBackground>
  );
}
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: authSpacing.lgPlus,
    paddingTop: authSpacing.lg,
    paddingBottom: 120,
    gap: authSpacing.md,
  },
  title: { ...authTextStyles.hero, color: authColors.textPrimary },
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
    alignItems: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: authSpacing.md },
});
