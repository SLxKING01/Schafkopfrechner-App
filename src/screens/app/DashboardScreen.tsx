import {
  BarChart3,
  Handshake,
  PlusCircle,
  ReceiptText,
  TableProperties,
} from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { OpenSettlementCard } from '../../components/dashboard/OpenSettlementCard';
import { QuickActionCard } from '../../components/dashboard/QuickActionCard';
import { RecentGameCard } from '../../components/dashboard/RecentGameCard';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { SyncStatus } from '../../components/game/SyncStatus';
import { AppText } from '../../components/ui/AppText';
import { useGameOverview } from '../../hooks/useGameOverview';
import { useOverviewNavigation } from '../../hooks/useOverviewNavigation';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { formatOverviewMoney } from '../../utils/gameOverview';

export function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const syncError = useGameStore((state) => state.syncError);
  const overview = useGameOverview();
  const { openTarget, openTables, openStatistics, createTable } =
    useOverviewNavigation();
  const username =
    typeof user?.user_metadata.username === 'string' &&
    user.user_metadata.username.trim()
      ? user.user_metadata.username
      : (user?.email?.split('@')[0] ?? 'Gast');
  const latestClosed =
    overview.payments[0]?.target ??
    overview.rounds.find((round) => round.target.kind === 'archive')?.target;
  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader username={username} email={user?.email} />
        {syncError ? (
          <View accessibilityRole="alert">
            <AppText>{syncError}</AppText>
          </View>
        ) : null}
        <SyncStatus />
        <Animated.View entering={FadeInDown.duration(520).delay(80)}>
          <StatsCard
            title="Deine Spielübersicht"
            subtitle="Aus deinen gespeicherten Spielabenden"
            stats={[
              { label: 'Runden gesamt', value: String(overview.rounds.length) },
              {
                label: 'Heute gespielt',
                value: String(overview.todayRounds),
                tone: 'green',
              },
              {
                label: 'Zahlungen offen',
                value: formatOverviewMoney(overview.openPaymentCents),
                tone: 'gold',
              },
              {
                label: 'Abgeschlossene Tische',
                value: String(overview.completedTables),
              },
            ]}
          />
        </Animated.View>
        {overview.activeTable ? (
          <View style={styles.emptyCard}>
            <AppText style={styles.emptyTitle}>
              {overview.activeTable.name}
            </AppText>
            <AppText style={styles.emptyCopy}>
              Dein Tisch ist gespeichert und bereit zum Weiterspielen.
            </AppText>
          </View>
        ) : null}
        <SectionHeader title="Schnellzugriff" />
        <View style={styles.actionGrid}>
          <QuickActionCard
            icon={PlusCircle}
            title={overview.activeTarget ? 'Weiterspielen' : 'Tisch erstellen'}
            subtitle={overview.activeTable?.name ?? 'Neuen Spielabend beginnen'}
            onPress={() =>
              overview.activeTarget
                ? openTarget(overview.activeTarget)
                : createTable()
            }
          />
          <QuickActionCard
            icon={TableProperties}
            title="Meine Tische"
            subtitle="Aktive Abende und Archiv"
            onPress={openTables}
          />
          <QuickActionCard
            icon={BarChart3}
            title="Statistik"
            subtitle="Runden und Spielerbilanzen"
            onPress={openStatistics}
          />
          <QuickActionCard
            icon={ReceiptText}
            title="Abrechnung öffnen"
            subtitle={
              overview.payments.length
                ? `${overview.payments.length} Zahlungen offen`
                : 'Abgeschlossene Tische ansehen'
            }
            onPress={() =>
              latestClosed ? openTarget(latestClosed) : openTables()
            }
          />
        </View>
        <SectionHeader
          title="Letzte Spiele"
          action="Alle anzeigen"
          onAction={openStatistics}
        />
        <View style={styles.stack}>
          {overview.rounds.length ? (
            overview.rounds.slice(0, 5).map((round) => (
              <RecentGameCard
                key={round.id}
                gameType={round.gameType}
                date={new Date(round.createdAt).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                amount={formatOverviewMoney(round.amountCents)}
                players={round.participants}
                winner={round.winnerName}
                tableName={round.tableName}
                onPress={() => openTarget(round.target)}
              />
            ))
          ) : (
            <EmptyGameState
              icon={PlusCircle}
              title="Noch keine Spiele"
              message="Sobald du eine Runde einträgst, erscheint sie hier mit dem echten Ergebnis."
            />
          )}
        </View>
        <SectionHeader
          title="Offene Zahlungen"
          action={String(overview.payments.length)}
        />
        <AppText style={styles.emptyCopy}>
          Aus abgeschlossenen Tischen. Laufende Salden bleiben am aktiven Tisch.
        </AppText>
        <View style={styles.stack}>
          {overview.payments.length ? (
            overview.payments
              .slice(0, 5)
              .map((payment) => (
                <OpenSettlementCard
                  key={payment.id}
                  from={payment.from}
                  to={payment.to}
                  tableName={payment.tableName}
                  amount={formatOverviewMoney(payment.amountCents)}
                  onOpen={() => openTarget(payment.target)}
                />
              ))
          ) : (
            <EmptyGameState
              icon={Handshake}
              title="Keine offenen Zahlungen"
              message="Hier erscheinen unbezahlte Abrechnungen abgeschlossener Tische."
            />
          )}
          {overview.payments.length > 5 ? (
            <QuickActionCard
              icon={ReceiptText}
              title="Alle Abrechnungen"
              subtitle={`${overview.payments.length} Zahlungen insgesamt offen`}
              onPress={openTables}
            />
          ) : null}
        </View>
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
    paddingHorizontal: authSpacing.xl,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.md,
  },
  stack: {
    gap: authSpacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.72)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    padding: authSpacing.xl,
  },
  emptyTitle: {
    color: authColors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    marginTop: authSpacing.md,
  },
  emptyCopy: {
    color: authColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: authSpacing.xs,
    textAlign: 'center',
  },
});
