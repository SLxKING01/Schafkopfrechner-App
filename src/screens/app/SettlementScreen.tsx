import { Handshake } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { MatchHistoryCard } from '../../components/game/MatchHistoryCard';
import { ScoreCard } from '../../components/game/ScoreCard';
import { SettlementCard } from '../../components/game/SettlementCard';
import { AppText } from '../../components/ui/AppText';
import type { AppStackScreenProps } from '../../navigation/types';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import {
  getStockBalanceCents,
  isStockBooking,
  roundWinnerIds,
} from '../../utils/accounting';
import { formatRoundGameType } from '../../utils/cardSuits';

type SettlementScreenProps = AppStackScreenProps<'Settlement'>;

function formatAmount(amount: number) {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export function SettlementScreen({ navigation, route }: SettlementScreenProps) {
  const currentTable = useGameStore((state) => state.currentTable);
  const currentPlayers = useGameStore((state) => state.players);
  const currentSettlements = useGameStore((state) => state.settlements);
  const currentRounds = useGameStore((state) => state.rounds);
  const currentBalances = useGameStore((state) => state.balances);
  const archivedGameDays = useGameStore((state) => state.archivedGameDays);
  const activeGame = useGameStore((state) => state.activeGame);
  const markSettlementPaid = useGameStore((state) => state.markSettlementPaid);
  const tableId = route?.params?.tableId ?? currentTable?.id;
  const archived = archivedGameDays.find((day) => day.table.id === tableId);
  const table =
    archived?.table ??
    (currentTable?.id === tableId && !activeGame ? currentTable : null);
  const players = archived?.players ?? currentPlayers;
  const settlements = archived?.settlements ?? currentSettlements;
  const rounds = archived?.rounds ?? currentRounds;
  const balances = archived?.balances ?? currentBalances;
  const total = settlements.reduce(
    (sum, settlement) => sum + settlement.amount,
    0,
  );
  const playerNameById = new Map(
    players.map((player) => [player.id, player.name]),
  );
  const getPlayerName = (id: string) => playerNameById.get(id) ?? 'Unbekannt';

  function startNewTable() {
    navigation.navigate('CreateTable');
  }

  if (!table) {
    return (
      <AuthBackground>
        <View style={styles.content}>
          <EmptyGameState
            icon={Handshake}
            title="Abrechnung nicht gefunden"
            message="Öffne einen abgeschlossenen Spielabend über deine Tische."
          />
          <GoldButton
            title="Zur Tischübersicht"
            onPress={() =>
              navigation.navigate('AppTabs', { screen: 'GameLobby' })
            }
          />
        </View>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>Abrechnung</AppText>
        <AppText style={styles.title}>{table.name}</AppText>
        <AppText style={styles.subtitle}>
          {archived?.completedAt
            ? `Abgeschlossen am ${new Date(archived.completedAt).toLocaleDateString('de-DE')}. `
            : 'Spieltag abgeschlossen. '}
          Runden und Zahlungsstände bleiben dauerhaft gespeichert.
        </AppText>

        <View style={styles.scoreRow}>
          <ScoreCard label="Zahlungen" value={`${settlements.length}`} />
          <ScoreCard label="Gesamt" value={formatAmount(total)} />
        </View>

        <View style={styles.stack}>
          {settlements.length === 0 ? (
            <EmptyGameState
              icon={Handshake}
              title="Nichts offen"
              message="Alle Spieler sind bereits ausgeglichen."
            />
          ) : (
            settlements.map((settlement) => (
              <SettlementCard
                key={settlement.id}
                amount={formatAmount(settlement.amount)}
                from={getPlayerName(settlement.fromPlayerId)}
                isPaid={settlement.isPaid}
                to={getPlayerName(settlement.toPlayerId)}
                onMarkPaid={() =>
                  markSettlementPaid(
                    settlement.id,
                    !settlement.isPaid,
                    table.id,
                  )
                }
              />
            ))
          )}
        </View>

        <View style={styles.stack}>
          <AppText style={styles.sectionTitle}>Endstände</AppText>
          {players.map((player) => (
            <View key={player.id} style={styles.balanceRow}>
              <AppText style={styles.balanceName}>{player.name}</AppText>
              <AppText style={styles.balanceAmount}>
                {formatAmount(
                  balances.find((balance) => balance.playerId === player.id)
                    ?.amount ?? 0,
                )}
              </AppText>
            </View>
          ))}
        </View>
        <View style={styles.stack}>
          <AppText style={styles.sectionTitle}>
            Spielverlauf ·{' '}
            {rounds.filter((round) => !isStockBooking(round)).length} Spiele
          </AppText>
          {[...rounds].reverse().map((round) => (
            <MatchHistoryCard
              key={round.id}
              details={
                round.declarerId && round.partnerId
                  ? `Spieler: ${getPlayerName(round.declarerId)} · Partner: ${getPlayerName(round.partnerId)} · ${roundWinnerIds(round).includes(round.declarerId) ? 'gewonnen' : 'verloren'}`
                  : undefined
              }
              stockDeposit={round.stockAction === 'deposit'}
              stockBooking={
                round.stockAction === 'carryIn'
                  ? 'Stock übernommen'
                  : round.stockAction === 'carryOut'
                    ? 'Stock übertragen'
                    : round.stockAction === 'refund'
                      ? 'Stock zurückgegeben'
                      : undefined
              }
              amount={formatAmount(
                round.amount +
                  (round.stockAction === 'payout'
                    ? getStockBalanceCents(
                        rounds.slice(
                          0,
                          rounds.findIndex((entry) => entry.id === round.id),
                        ),
                      ) / 100
                    : 0),
              )}
              gameType={
                formatRoundGameType(round.gameType, round.suit) +
                (round.stockAction === 'payout'
                  ? ` + Stock ${formatAmount(
                      getStockBalanceCents(
                        rounds.slice(
                          0,
                          rounds.findIndex((entry) => entry.id === round.id),
                        ),
                      ) / 100,
                    )}`
                  : '')
              }
              losers={round.loserIds.map(getPlayerName).join(', ')}
              winner={roundWinnerIds(round).map(getPlayerName).join(' & ')}
              time={new Date(round.createdAt).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          ))}
        </View>
        <GoldButton
          title="Zur Tischübersicht"
          onPress={() =>
            navigation.navigate('AppTabs', { screen: 'GameLobby' })
          }
        />
        {activeGame ? (
          <GoldButton
            title="Aktuellen Tisch öffnen"
            onPress={() => navigation.navigate('ActiveGame')}
          />
        ) : (
          <GoldButton title="Neuen Tisch starten" onPress={startNewTable} />
        )}
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: authColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(245,245,245,0.12)',
  },
  balanceName: { color: authColors.textPrimary, flex: 1 },
  balanceAmount: {
    color: authColors.goldHighlight,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  content: {
    gap: authSpacing.xl,
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
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.body,
    lineHeight: 23,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: authSpacing.md,
  },
  stack: {
    gap: authSpacing.md,
  },
});
