import { Handshake } from 'lucide-react-native';
import { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { InterimPaymentsPanel } from '../../components/game/InterimPaymentsPanel';
import { MatchHistoryCard } from '../../components/game/MatchHistoryCard';
import { RoundEntrySheet } from '../../components/game/RoundEntrySheet';
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
import { AppButton } from '../../components/ui/AppButton';
import { appAlert } from '../../components/ui/AppDialog';
import { AppText } from '../../components/ui/AppText';
import { InteractionSheet } from '../../components/ui/InteractionSheet';
import type { AppStackScreenProps } from '../../navigation/types';
import { planClosedTableCorrection } from '../../services/game/closedTableCorrection';
import {
  allowedPaymentActions,
  paymentActionLabels,
  paymentState,
  useSettlementEvents,
} from '../../services/shared/settlementEvents';
import { saveSharedTableCorrection } from '../../services/shared/sharedTables';
import { reliableStorage } from '../../storage/reliableStorage';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { CreateRoundPayload, GameRound } from '../../types/game';
import {
  getStockBalanceCents,
  isCustomBooking,
  isPlayedRound,
  isStockBooking,
  roundWinnerIds,
} from '../../utils/accounting';
import { formatRoundGameType } from '../../utils/cardSuits';
import {
  isCarriedPayment,
  outstandingBalances,
} from '../../utils/interimPayments';
import { paypalMePaymentURL } from '../../utils/paypalMe';
import { createStatisticsTable } from '../../utils/statistics';
import { tableAccess } from '../../utils/tableAccess';

type SettlementScreenProps = AppStackScreenProps<'Settlement'>;

function formatAmount(amount: number) {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export function SettlementScreen({ navigation, route }: SettlementScreenProps) {
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [paypalErrorId, setPaypalErrorId] = useState<string>();
  const [correctionRound, setCorrectionRound] = useState<GameRound | null>(
    null,
  );
  const [preview, setPreview] = useState<ReturnType<
    typeof planClosedTableCorrection
  > | null>(null);
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionError, setCorrectionError] = useState('');
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
  const shared = !!table?.shared;
  const journal = useSettlementEvents(
    table && !table.isActive && shared && table.shared?.userId === actorId
      ? table.id
      : undefined,
    actorId,
  );
  const payments = settlements.map((payment) => {
    const status = paymentState(payment, journal.events ?? []);
    const target = journal.links?.find((link) => link.paymentId === payment.id);
    const payer = players.find(({ id }) => id === payment.fromPlayerId);
    const recipient = players.find(({ id }) => id === payment.toPlayerId);
    const paypalURL =
      target &&
      actorId &&
      payer?.userId === actorId &&
      recipient?.userId === target.recipientId &&
      target.amount === payment.amount &&
      !status.confirmed &&
      !status.reported
        ? paypalMePaymentURL(target.handle, target.amount)
        : null;
    return { payment, status, paypalURL };
  });
  const openPayments = payments.filter(
    ({ status }) => !status.confirmed,
  ).length;
  const paymentTotals = payments.reduce(
    (totals, { payment, status }) => {
      const key = status.confirmed
        ? 'confirmed'
        : status.reported
          ? 'reported'
          : 'open';
      totals[key] += Math.round(payment.amount * 100);
      return totals;
    },
    { open: 0, reported: 0, confirmed: 0 },
  );
  const playerNameById = new Map(
    players.map((player) => [player.id, player.name]),
  );
  const getPlayerName = (id: string) => playerNameById.get(id) ?? 'Unbekannt';
  const canCorrect =
    !!archived &&
    !table?.isActive &&
    tableAccess(table, actorId).canManage &&
    (!shared || !!journal.events);

  function previewCorrection(payload: CreateRoundPayload) {
    if (!archived || !correctionRound || !canCorrect)
      throw new Error('Dieser Abschluss ist nicht zur Korrektur verfügbar.');
    setPreview(
      planClosedTableCorrection(
        archived,
        correctionRound.id,
        payload,
        journal.events ?? [],
      ),
    );
    setCorrectionRound(null);
    setCorrectionError('');
  }

  async function saveCorrection() {
    if (!preview || !canCorrect || preview.pending || correctionBusy) return;
    setCorrectionBusy(true);
    setCorrectionError('');
    try {
      if (preview.day.table.shared) {
        await saveSharedTableCorrection(preview.day, preview.expectedEvent);
      } else {
        const state = useGameStore.getState();
        const before = state.archivedGameDays.find(
          (day) => day.table.id === preview.day.table.id,
        );
        const lastRevision = preview.day.table.settlementRevisions?.at(-1);
        if (
          before?.table.settlementRevisions?.at(-1)?.id === lastRevision?.id
        ) {
          await reliableStorage.retryWrites();
        } else {
          if (
            !before ||
            before.table.shared ||
            before.balances !== lastRevision?.balances ||
            before.settlements !== lastRevision?.settlements
          )
            throw new Error(
              'Der Tisch wurde geändert. Bitte erstelle eine neue Vorschau.',
            );
          useGameStore.setState({
            archivedGameDays: state.archivedGameDays.map((day) =>
              day === before ? preview.day : day,
            ),
            ...(state.currentTable?.id === preview.day.table.id
              ? {
                  currentTable: preview.day.table,
                  rounds: preview.day.rounds,
                  balances: preview.day.balances,
                  settlements: preview.day.settlements,
                }
              : {}),
          });
        }
        if (!(await reliableStorage.confirmWrite('schafkopfrechner-games')))
          throw new Error(
            'Die Korrektur ist noch nicht auf dem Gerät gesichert. Bitte erneut speichern.',
          );
      }
      setPreview(null);
    } catch (error) {
      setCorrectionError(
        error instanceof Error
          ? error.message
          : 'Die Korrektur konnte nicht gespeichert werden.',
      );
    } finally {
      setCorrectionBusy(false);
    }
  }

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
            settlements={payments.map(({ payment, status }) => ({
              ...payment,
              isPaid: status.confirmed,
            }))}
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
        {shared && !table.isActive ? (
          journal.events ? (
            <AppText style={styles.subtitle}>
              Offen {formatAmount(paymentTotals.open / 100)} · Gemeldet,
              unbestätigt {formatAmount(paymentTotals.reported / 100)} ·
              Bestätigt {formatAmount(paymentTotals.confirmed / 100)}
            </AppText>
          ) : (
            <AppText style={styles.subtitle}>
              {journal.error ?? 'Zahlungsstatus werden geladen …'}
            </AppText>
          )
        ) : settlements.length > 0 && openPayments === 0 ? (
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
                payments.map(({ payment: settlement, status, paypalURL }) => (
                  <SettlementCard
                    key={settlement.id}
                    amount={formatAmount(settlement.amount)}
                    from={getPlayerName(settlement.fromPlayerId)}
                    isPaid={status.confirmed}
                    status={
                      shared
                        ? journal.events || settlement.isPaid
                          ? status.label
                          : 'Status wird geprüft'
                        : undefined
                    }
                    to={getPlayerName(settlement.toPlayerId)}
                    onMarkPaid={
                      !shared &&
                      tableAccess(table, actorId).canManage &&
                      !isCarriedPayment(table, settlement.id)
                        ? () =>
                            markSettlementPaid(
                              settlement.id,
                              !settlement.isPaid,
                              table.id,
                            )
                        : undefined
                    }
                  >
                    {shared && journal.events ? (
                      <>
                        {paypalURL ? (
                          <AppButton
                            title="Mit PayPal bezahlen"
                            onPress={async () => {
                              setPaypalErrorId(undefined);
                              try {
                                if (Platform.OS === 'web')
                                  window.location.assign(paypalURL);
                                else await Linking.openURL(paypalURL);
                              } catch {
                                setPaypalErrorId(settlement.id);
                              }
                            }}
                          />
                        ) : null}
                        {paypalErrorId === settlement.id ? (
                          <AppText
                            accessibilityRole="alert"
                            style={styles.subtitle}
                          >
                            PayPal konnte nicht geöffnet werden. Bitte versuche
                            es erneut.
                          </AppText>
                        ) : null}
                        {allowedPaymentActions(
                          settlement,
                          status,
                          players,
                          table,
                          actorId,
                        ).map((action) => (
                          <AppButton
                            key={action}
                            title={paymentActionLabels[action]}
                            variant="secondary"
                            disabled={journal.busy}
                            onPress={() => {
                              void journal
                                .record(settlement.id, action)
                                .catch(() =>
                                  appAlert(
                                    'Zahlungsstatus konnte nicht geändert werden',
                                    'Der aktuelle Stand wird neu geladen. Bitte prüfe ihn und versuche es bei Bedarf erneut.',
                                  ),
                                );
                            }}
                          />
                        ))}
                        {status.history.map((event) => (
                          <AppText key={event.id} style={styles.subtitle}>
                            {event.actor_name}
                            {event.delegated ? ` für ${event.player_name}` : ''}
                            {' · '}
                            {
                              {
                                report: 'Zahlung gemeldet',
                                confirm: 'Eingang bestätigt',
                                undo_report: 'Meldung zurückgenommen',
                                undo_confirm: 'Bestätigung zurückgenommen',
                              }[event.action]
                            }
                            {' · '}
                            {new Date(event.occurred_at).toLocaleString(
                              'de-DE',
                            )}
                          </AppText>
                        ))}
                      </>
                    ) : null}
                  </SettlementCard>
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
        {shared && tableAccess(table, actorId).canManage ? (
          <StatAction
            onPress={() =>
              navigation.navigate('TableInvitations', { tableId: table.id })
            }
          >
            Tischzugriffe verwalten
          </StatAction>
        ) : null}
        <View style={styles.stack}>
          <AppText style={styles.sectionTitle}>
            Spielverlauf · {rounds.filter(isPlayedRound).length} Spiele
          </AppText>
          {[...rounds].reverse().map((round) => (
            <View key={round.id} style={styles.stack}>
              <RoundHistoryActions
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
                      ? `Mitgespielt: ${round.participantIds.map(getPlayerName).join(', ')}${round.roundContext ? ` · Geber: ${getPlayerName(round.roundContext.dealerIdBefore)}` : ''}`
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
                              rounds.findIndex(
                                (entry) => entry.id === round.id,
                              ),
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
                              rounds.findIndex(
                                (entry) => entry.id === round.id,
                              ),
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
              {canCorrect &&
              !round.misdealPlayerId &&
              (!round.stockAction ||
                ['deposit', 'payout', 'double'].includes(round.stockAction)) ? (
                <StatAction onPress={() => setCorrectionRound(round)}>
                  Spiel im Abschluss korrigieren
                </StatAction>
              ) : null}
            </View>
          ))}
        </View>
        {!!table.settlementRevisions?.length && (
          <StatPanel>
            <StatHeading>Frühere Abrechnungsversionen</StatHeading>
            {table.settlementRevisions.map((revision) => (
              <View key={revision.id} style={styles.stack}>
                <AppText>
                  {revision.actor.name} ·{' '}
                  {new Date(revision.occurredAt).toLocaleString('de-DE')}
                </AppText>
                {revision.settlements.map((payment) => (
                  <AppText key={payment.id}>
                    {getPlayerName(payment.fromPlayerId)} an{' '}
                    {getPlayerName(payment.toPlayerId)}:{' '}
                    {formatAmount(payment.amount)}
                    {revision.carriedPaymentIds.includes(payment.id)
                      ? ' · bestätigt übernommen'
                      : ''}
                  </AppText>
                ))}
              </View>
            ))}
          </StatPanel>
        )}
        {correctionRound ? (
          <RoundEntrySheet
            table={table}
            players={players}
            editingRound={correctionRound}
            visible
            onClose={() => setCorrectionRound(null)}
            onDismiss={() => {}}
            onSaved={() => {}}
            onPreviewCorrection={previewCorrection}
          />
        ) : null}
        {preview ? (
          <InteractionSheet
            visible
            dismissible={!correctionBusy}
            onClose={() => setPreview(null)}
          >
            <ScrollView
              contentContainerStyle={{
                padding: authSpacing.xl,
                gap: authSpacing.md,
              }}
            >
              <AppText variant="subtitle">
                Vorschau der Differenzabrechnung
              </AppText>
              {preview.day.balances.map((balance) => (
                <AppText key={balance.playerId}>
                  {getPlayerName(balance.playerId)}:{' '}
                  {formatAmount(
                    preview.day.table.settlementRevisions
                      ?.at(-1)
                      ?.balances.find(
                        (old) => old.playerId === balance.playerId,
                      )?.amount ?? 0,
                  )}
                  {' → '}
                  {formatAmount(balance.amount)}
                </AppText>
              ))}
              {preview.day.settlements
                .filter(
                  (payment) =>
                    !preview.day.table.settlementRevisions
                      ?.at(-1)
                      ?.carriedPaymentIds.includes(payment.id),
                )
                .map((payment) => (
                  <AppText key={payment.id}>
                    {getPlayerName(payment.fromPlayerId)} an{' '}
                    {getPlayerName(payment.toPlayerId)}:{' '}
                    {formatAmount(payment.amount)}
                  </AppText>
                ))}
              {preview.pending ? (
                <AppText accessibilityRole="alert">
                  Gemeldete Zahlungen müssen vor dem Speichern bestätigt oder
                  zurückgenommen werden.
                </AppText>
              ) : null}
              {correctionError ? (
                <AppText accessibilityRole="alert">{correctionError}</AppText>
              ) : null}
              <AppButton
                title="Korrektur verbindlich speichern"
                disabled={preview.pending}
                loading={correctionBusy}
                onPress={() => void saveCorrection()}
              />
              <AppButton
                title="Abbrechen"
                variant="secondary"
                disabled={correctionBusy}
                onPress={() => setPreview(null)}
              />
            </ScrollView>
          </InteractionSheet>
        ) : null}
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
