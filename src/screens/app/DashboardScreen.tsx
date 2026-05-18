import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Calculator,
  Handshake,
  PlusCircle,
  ReceiptText,
  UserPlus,
} from 'lucide-react-native';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
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

const recentGames = [
  {
    gameType: 'Sauspiel',
    date: 'Heute',
    amount: '18,00 €',
    players: 4,
    result: 'win' as const,
  },
  {
    gameType: 'Wenz',
    date: 'Gestern',
    amount: '12,00 €',
    players: 4,
    result: 'loss' as const,
  },
  {
    gameType: 'Solo',
    date: 'Samstag',
    amount: '42,00 €',
    players: 5,
    result: 'win' as const,
  },
];

const settlements = [
  { from: 'Max', to: 'Simon', amount: '10,00 €' },
  { from: 'Lukas', to: 'Anna', amount: '6,50 €' },
];
type DashboardNavigationProp = NativeStackNavigationProp<AppStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const user = useAuthStore((state) => state.user);
  const activeGame = useGameStore((state) => state.activeGame);
  const currentTable = useGameStore((state) => state.currentTable);
  const syncing = useGameStore((state) => state.syncing);
  const isOffline = useGameStore((state) => state.isOffline);
  const lastSyncedAt = useGameStore((state) => state.lastSyncedAt);
  const username =
    typeof user?.user_metadata.username === 'string'
      ? user.user_metadata.username
      : 'Simon';

  function showPrepared() {
    Alert.alert(
      'Vorbereitet',
      'Diese Aktion wird im naechsten Schritt mit echten Supabase Daten verbunden.',
    );
  }

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
            title="Dein Spieltag"
            subtitle="Premium Ueberblick fuer die Runde"
            stats={[
              { label: 'Gespielte Runden', value: '24' },
              { label: 'Gewinnrate', value: '62 %', tone: 'green' },
              { label: 'Offen', value: '16,50 €', tone: 'gold' },
              { label: 'Heute', value: '+28 €', tone: 'green' },
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
            icon={UserPlus}
            title="Freunde einladen"
            subtitle="Lobby vorbereiten"
            onPress={showPrepared}
          />
          <QuickActionCard
            icon={ReceiptText}
            title="Abrechnung"
            subtitle="Zahlungen klaeren"
            onPress={showPrepared}
          />
        </View>

        <SectionHeader title="Letzte Spiele" action="Alle anzeigen" />
        <View style={styles.stack}>
          {recentGames.map((game) => (
            <RecentGameCard key={`${game.gameType}-${game.date}`} {...game} />
          ))}
        </View>

        <SectionHeader title="Offene Zahlungen" action="PayPal bereit" />
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
                key={`${settlement.from}-${settlement.to}`}
                {...settlement}
                onPayPress={showPrepared}
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
