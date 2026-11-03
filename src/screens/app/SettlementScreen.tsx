import { Handshake } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { InterimPaymentsPanel } from '../../components/game/InterimPaymentsPanel';
import { MatchHistoryCard } from '../../components/game/MatchHistoryCard';
import { RoundHistoryActions } from '../../components/game/RoundHistoryActions';
import { RoundHistoryModal } from '../../components/game/RoundHistoryView';
import { SettlementCard } from '../../components/game/SettlementCard';
import { SettlementShare } from '../../components/game/SettlementShare';
import {
  Money,
  StatAction,
  StatHeading,
  StatNote,
  StatPanel,
} from '../../components/statistics/StatisticsPanels';
import { AppText } from '../../components/ui/AppText';
import type { AppStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import {
  getStockBalanceCents,
  isCustomBooking,
  isPlayedRound,
  isStockBooking,
  roundWinnerIds,
} from '../../utils/accounting';
import { formatRoundGameType } from '../../utils/cardSuits';
import { outstandingBalances } from '../../utils/interimPayments';
import { createStatisticsTable } from '../../utils/statistics';
import { tableAccess } from '../../utils/tableAccess';

type SettlementScreenProps = AppStackScreenProps<'Settlement'>;

function formatAmount(amount: number) {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export function SettlementScreen({ navigation, route }: SettlementScreenProps) {
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const currentTable = useGameStore((state) => state.currentTable);
  const actorId = useAuthStore((state) => state.user?.id);
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
    archived?.table ?? (currentTable?.id === tableId ? currentTable : null);
  const players = archived?.players ?? currentPlayers;
  const settlements = archived?.settlements ?? currentSettlements;
  const rounds = archived?.rounds ?? currentRounds;
  const balances = archived?.balances ?? currentBalances;
  const openPayments = settlements.filter(({ isPaid }) => !isPaid).length;
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

  const displayedBalances = outstandingBalances(
    balances,
    table.interimPayments,
  );
  const selected =
    table && route?.params?.roundId
      ? createStatisticsTable(
          `table:${table.id}`,
          table.name,
          players,
          rounds,
          { kind: 'archive', tableId: table.id },
          'id',
        ).rounds.find((r) => r.id === route.params?.roundId)
      : undefined;
  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>
          {table.isActive ? 'Zwischenabrechnung' : 'Abrechnung'}
        </AppText>
        <AppText style={styles.title}>{table.name}</AppText>
        {selected ? (
          <StatPanel>
            <StatHeading>
              {formatRoundGameType(selected.type, selected.suit)}
            </StatHeading>
            <StatNote>
              Ausgewähltes Spiel ·{' '}
              {new Date(selected.createdAt).toLocaleString('de-DE')}
            </StatNote>
            {players
              .filter((p) => selected.participants.includes(p.id))
              .map((p) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText>{p.name}</AppText>
                  <Money value={selected.deltas[p.id] ?? 0} />
                </View>
              ))}
            <StatNote>
              Reines Spielergebnis ohne Stock. Abgeschlossene Tische werden hier
              nur angezeigt.
            </StatNote>
          </StatPanel>
        ) : null}
        <AppText style={styles.subtitle}>
          {archived?.completedAt
            ? `${new Date(archived.completedAt).toLocaleDateString('de-DE')} · `
            : ''}
          {players.length} Spieler
        </AppText>
        {!table.isActive ? (
          <SettlementShare
            table={table}
            players={players}
            balances={balances}
            settlements={settlements}
            completedAt={archived?.completedAt ?? null}
          />
        ) : null}
        <AppText accessibilityRole="header" style={styles.sectionTitle}>
          {table.isActive
            ? 'Bezahlen und weiterspielen'
            : openPayments === 0
              ? 'Keine Zahlungen offen'
              : `${openPayments} ${openPayments === 1 ? 'Zahlung' : 'Zahlungen'} zum Ausgleichen`}
        </AppText>
        {settlements.length > 0 && openPayments === 0 ? (
          <AppText style={styles.subtitle}>
            Alle Zahlungen sind als bezahlt markiert.
          </AppText>
        ) : null}
        {table.isActive ? (
          <InterimPaymentsPanel
            table={table}
            players={players}
            balances={balances}
            plan={settlements}
            stockCents={getStockBalanceCents(rounds)}
          />
        ) : (
          <>
            <View style={styles.stack}>
              {settlements.length === 0 ? (
                <EmptyGameState
                  icon={Handshake}
                  title="Keine Zahlungen nötig"
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
                    onMarkPaid={
                      tableAccess(table, actorId).canManage
                        ? () =>
                            markSettlementPaid(
                              settlement.id,
                              !settlement.isPaid,
                              table.id,
                            )
                        : undefined
                    }
                  />
                ))
              )}
            </View>
          </>
        )}
        <View style={styles.stack}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Endstände anzeigen"
            accessibilityState={{ expanded: expandedTableId === table.id }}
            onPress={() =>
              setExpandedTableId(expandedTableId === table.id ? null : table.id)
            }
            style={styles.disclosure}
          >
            <AppText style={styles.sectionTitle}>
              {table.isActive ? 'Noch offene Beträge' : 'Endstände'}
            </AppText>
            <AppText style={styles.subtitle}>
              {expandedTableId === table.id ? '−' : '+'}
            </AppText>
          </Pressable>
          {expandedTableId === table.id
            ? players.map((player) => {
                const amount =
                  displayedBalances.find(
                    (balance) => balance.playerId === player.id,
                  )?.amount ?? 0;
                return (
                  <View key={player.id} style={styles.balanceRow}>
                    <AppText selectable style={styles.balanceName}>
                      {player.name}
                    </AppText>
                    <AppText selectable style={styles.balanceAmount}>
                      {amount > 0 ? '+' : ''}
                      {formatAmount(amount)}
                    </AppText>
                  </View>
                );
              })
            : null}
        </View>
        {!table.isActive && table.interimPayments?.some((p) => !p.voidedAt) ? (
          <View style={styles.stack}>
            <AppText style={styles.sectionTitle}>
              Bereits während des Abends bezahlt
            </AppText>
            {table.interimPayments
              .filter((p) => !p.voidedAt)
              .map((p) => (
                <AppText key={p.id} style={styles.subtitle}>
                  {getPlayerName(p.fromPlayerId)} →{' '}
                  {getPlayerName(p.toPlayerId)} · {formatAmount(p.amount)}
                </AppText>
              ))}
          </View>
        ) : null}
        <StatAction
          onPress={() =>
            navigation.navigate('TableStatistics', {
              tableKey: `table:${table.id}`,
            })
          }
        >
          Tischstatistik öffnen
        </StatAction>
        <StatAction onPress={() => setHistoryVisible(true)}>
          Änderungsverlauf des Tisches
        </StatAction>
        <View style={styles.stack}>
          <AppText style={styles.sectionTitle}>
            Spielverlauf · {rounds.filter(isPlayedRound).length} Spiele
          </AppText>
          {[...rounds].reverse().map((round) => (
            <RoundHistoryActions
              key={round.id}
              table={table}
              players={players}
              rounds={rounds}
              round={round}
            >
              <MatchHistoryCard
                misdealPlayer={
                  round.misdealPlayerId
                    ? getPlayerName(round.misdealPlayerId)
                    : undefined
                }
                customAmounts={
                  isCustomBooking(round)
                    ? round.customAmounts!.map((entry) => ({
                        name: getPlayerName(entry.playerId),
                        amount: entry.amount,
                      }))
                    : undefined
                }
                participation={
                  round.participantIds
                    ? `Mitgespielt: ${round.participantIds.map(getPlayerName).join(', ')}${round.roundContext ? ` � Geber: ${getPlayerName(round.roundContext.dealerIdBefore)}` : ''}`
                    : undefined
                }
                stockMovement={
                  round.stockRulesVersion === 1 &&
                  (round.stockAction === 'double' ||
                    round.stockAction === 'payout')
                    ? `Stock ${round.stockAction === 'double' ? 'verdoppelt' : 'ausgezahlt'}: ${formatAmount((round.stockBeforeCents ?? 0) / 100)} → ${formatAmount((round.stockAfterCents ?? 0) / 100)}`
                    : undefined
                }
                details={
                  isStockBooking(round) || isCustomBooking(round)
                    ? undefined
                    : round.declarerId
                      ? `Ansager: ${getPlayerName(round.declarerId)}${round.partnerId ? ` · Partner: ${getPlayerName(round.partnerId)}` : ''}`
                      : 'Ansager: unbekannt'
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
            </RoundHistoryActions>
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
      {historyVisible ? (
        <RoundHistoryModal
          table={table}
          rounds={rounds}
          players={players}
          onClose={() => setHistoryVisible(false)}
        />
      ) : null}
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
  disclosure: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: authSpacing.md,
  },
  stack: {
    gap: authSpacing.md,
  },
});
