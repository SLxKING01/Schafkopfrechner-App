import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Calculator,
  Handshake,
  PlusCircle,
  ReceiptText,
} from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { OpenSettlementCard } from '../../components/dashboard/OpenSettlementCard';
import { QuickActionCard } from '../../components/dashboard/QuickActionCard';
import { RecentGameCard } from '../../components/dashboard/RecentGameCard';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { SyncStatusBadge } from '../../components/dashboard/SyncStatusBadge';
import { AppText } from '../../components/ui/AppText';
import type { AppStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';

type DashboardNavigationProp = NativeStackNavigationProp<AppStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const user = useAuthStore((state) => state.user);
  const activeGame = useGameStore((state) => state.activeGame);
  const currentTable = useGameStore((state) => state.currentTable);
  const syncing = useGameStore((state) => state.syncing);
  const isOffline = useGameStore((state) => state.isOffline);
  const lastSyncedAt = useGameStore((state) => state.lastSyncedAt);
  const rounds = useGameStore((state) => state.rounds);
  const players = useGameStore((state) => state.players);
  const tableSettlements = useGameStore((state) => state.settlements);
  const settlements = tableSettlements.filter((entry) => !entry.isPaid);
  const recentGames = [...rounds].reverse().slice(0, 3);
  const formatAmount = (amount: number) =>
    `${amount.toFixed(2).replace('.', ',')} €`;
  const username =
    typeof user?.user_metadata.username === 'string'
      ? user.user_metadata.username
      : 'Spieler';

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader username={username} email={user?.email} />
        <SyncStatusBadge
          isOffline={isOffline}
          lastSyncedAt={lastSyncedAt}
          syncing={syncing}
        />

        <Animated.View entering={FadeInDown.duration(520).delay(80)}>
          <StatsCard
            title="Aktueller Tisch"
            subtitle={currentTable?.name ?? 'Noch kein Tisch gestartet'}
            stats={[
              { label: 'Gespielte Runden', value: `${rounds.length}` },
              { label: 'Spieler', value: `${players.length}` },
              {
                label: 'Offen',
                value: formatAmount(
                  settlements.reduce((sum, entry) => sum + entry.amount, 0),
                ),
                tone: 'gold',
              },
              {
                label: 'Umsatz',
                value: formatAmount(
                  rounds.reduce((sum, round) => sum + round.amount, 0),
                ),
              },
            ]}
          />
        </Animated.View>

        <SectionHeader title="Quick Actions" />
        <View style={styles.actionGrid}>
          <QuickActionCard
            icon={PlusCircle}
            title="Neues Spiel"
            subtitle="Runde schnell erfassen"
            onPress={() =>
              navigation.navigate(
                activeGame && currentTable ? 'ActiveGame' : 'CreateTable',
              )
            }
          />
          <QuickActionCard
            icon={Calculator}
            title="Offline Spiel"
            subtitle="Ohne Sync abrechnen"
            onPress={() =>
              navigation.navigate(
                activeGame && currentTable ? 'ActiveGame' : 'CreateTable',
              )
            }
          />
          <QuickActionCard
            icon={ReceiptText}
            title="Tischarchiv"
            subtitle="Fruehere Tische ansehen"
            onPress={() => navigation.navigate('TableArchive')}
          />
          <QuickActionCard
            icon={ReceiptText}
            title="Abrechnung"
            subtitle="Zahlungen klären"
            onPress={() =>
              currentTable
                ? navigation.navigate('Settlement')
                : navigation.navigate('TableArchive')
            }
          />
        </View>

        <GoldButton
          title="Tischarchiv öffnen"
          onPress={() => navigation.navigate('TableArchive')}
        />
        <SectionHeader title="Letzte Spiele am Tisch" />
        <View style={styles.stack}>
          {recentGames.length === 0 ? (
            <AppText>Noch keine Spiele erfasst.</AppText>
          ) : (
            recentGames.map((game) => (
              <RecentGameCard
                key={game.id}
                gameType={game.gameType}
                date={new Date(game.createdAt).toLocaleDateString('de-DE')}
                amount={formatAmount(game.amount)}
                players={
                  new Set([
                    ...(game.winnerIds ?? [game.winnerId]),
                    ...game.loserIds,
                  ]).size
                }
                result="neutral"
              />
            ))
          )}
        </View>

        <SectionHeader title="Offene Zahlungen am Tisch" />
        <View style={styles.stack}>
          {settlements.length === 0 ? (
            <View style={styles.emptyCard}>
              <Handshake color={authColors.gold} size={24} strokeWidth={2} />
              <AppText style={styles.emptyTitle}>Alles ausgeglichen</AppText>
              <AppText style={styles.emptyCopy}>
                Sobald offene Salden entstehen, erscheinen sie hier.
              </AppText>
            </View>
          ) : (
            settlements.map((settlement) => (
              <OpenSettlementCard
                key={settlement.id}
                from={
                  players.find(
                    (player) => player.id === settlement.fromPlayerId,
                  )?.name ?? 'Entfernter Spieler'
                }
                to={
                  players.find((player) => player.id === settlement.toPlayerId)
                    ?.name ?? 'Entfernter Spieler'
                }
                amount={formatAmount(settlement.amount)}
                onPayPress={() => navigation.navigate('Settlement')}
              />
            ))
          )}
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
