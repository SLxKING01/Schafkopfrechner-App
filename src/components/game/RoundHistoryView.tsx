import { type ReactElement, useState } from 'react';
import {
  FlatList,
  type FlatListProps,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authColors } from '../../theme/colors';
import { authControlSizes, authRadius, authSpacing } from '../../theme/spacing';
import type {
  GameRound,
  GameTable,
  Player,
  RoundHistoryEvent,
} from '../../types/game';
import { formatRoundGameType } from '../../utils/cardSuits';
import {
  roundHistoryDiff,
  roundHistorySummary,
} from '../../utils/roundHistory';
import { GoldButton } from '../auth/GoldButton';
import { AppText } from '../ui/AppText';

type Props = {
  table: GameTable;
  rounds: GameRound[];
  players: Player[];
  roundId?: string;
  onClose: () => void;
  onRestore?: (roundId: string) => string | undefined;
};

export function RoundHistoryModal(props: Props) {
  return (
    <Modal visible animationType="none" onRequestClose={props.onClose}>
      <RoundHistoryContent {...props} />
    </Modal>
  );
}

export function RoundHistoryContent({
  table,
  rounds,
  players,
  roundId,
  onClose,
  onRestore,
}: Props) {
  const events = (table.roundHistory ?? [])
    .filter((event) => !roundId || event.roundId === roundId)
    .slice()
    .reverse();
  const current = roundId ? rounds.find((r) => r.id === roundId) : undefined;
  const latest = events[0];
  const removed = !!roundId && !current && latest?.action === 'deleted';
  const latestByRound = new Map(
    (table.roundHistory ?? []).map((event) => [event.roundId, event]),
  );
  const renderEvent = (event: RoundHistoryEvent) => (
    <HistoryEvent
      key={event.id}
      event={event}
      showGame={!roundId}
      onRestore={
        onRestore &&
        table.isActive &&
        event.action === 'deleted' &&
        latestByRound.get(event.roundId)?.id === event.id &&
        !rounds.some((r) => r.id === event.roundId)
          ? () => onRestore(event.roundId)
          : undefined
      }
    />
  );
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Änderungsverlauf schließen"
          onPress={onClose}
          style={styles.back}
        >
          <AppText style={styles.backText}>‹</AppText>
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText accessibilityRole="header" style={styles.title}>
            Änderungsverlauf
          </AppText>
          <AppText style={styles.note}>
            {current
              ? formatRoundGameType(current.gameType, current.suit)
              : removed
                ? 'Gelöschtes Spiel'
                : table.name}
          </AppText>
        </View>
      </View>
      <HistoryList
        scoped={!!roundId}
        renderEvent={renderEvent}
        data={events}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          roundId ? (
            <View style={styles.current}>
              <AppText style={styles.note}>
                {removed ? 'Nicht mehr in der Abrechnung' : 'Aktueller Stand'}
              </AppText>
              {current ? (
                <AppText style={styles.currentText}>
                  {roundHistorySummary(current, players)}
                </AppText>
              ) : removed && latest.before ? (
                <AppText style={styles.currentText}>
                  {formatRoundGameType(
                    latest.before.gameType,
                    latest.before.suit,
                  )}{' '}
                  · zurückgenommen
                </AppText>
              ) : null}
            </View>
          ) : (
            <AppText style={styles.note}>
              Alle protokollierten Aktionen, einschließlich zurückgenommener
              Spiele.
            </AppText>
          )
        }
        ListEmptyComponent={
          <AppText style={styles.empty}>
            Noch kein Änderungsverlauf vorhanden. Aktionen vor Einführung des
            Protokolls wurden nicht aufgezeichnet.
          </AppText>
        }
        renderItem={({ item }) => renderEvent(item)}
        ListFooterComponent={
          <AppText style={styles.footer}>
            {roundId && events.length > 0 && events.at(-1)?.action !== 'created'
              ? 'Frühere Aktionen wurden noch nicht aufgezeichnet.\n\n'
              : ''}
            Für die Abrechnung zählt nur der aktuelle Stand. Historische Werte
            werden nicht zusätzlich verbucht.
          </AppText>
        }
      />
    </SafeAreaView>
  );
}

// A row's modal retains its parent list context, even across a native Modal.
// A single game's short history uses its own ScrollView to avoid being treated
// as an inline nested virtualized list. The full table history stays virtualized.
function HistoryList({
  scoped,
  renderEvent,
  ...props
}: Omit<
  FlatListProps<RoundHistoryEvent>,
  'ListHeaderComponent' | 'ListFooterComponent' | 'ListEmptyComponent'
> & {
  scoped: boolean;
  renderEvent: (event: RoundHistoryEvent) => ReactElement;
  ListHeaderComponent: ReactElement;
  ListFooterComponent: ReactElement;
  ListEmptyComponent: ReactElement;
}) {
  if (!scoped) return <FlatList {...props} />;
  return (
    <ScrollView
      contentContainerStyle={props.contentContainerStyle}
      showsVerticalScrollIndicator={false}
    >
      {props.ListHeaderComponent}
      {props.data?.length
        ? Array.from(props.data).map(renderEvent)
        : props.ListEmptyComponent}
      {props.ListFooterComponent}
    </ScrollView>
  );
}

function HistoryEvent({
  event,
  showGame,
  onRestore,
}: {
  event: RoundHistoryEvent;
  showGame: boolean;
  onRestore?: () => string | undefined;
}) {
  const [restoreError, setRestoreError] = useState<string>();
  const diffs = roundHistoryDiff(event);
  const round = event.after ?? event.before!;
  const name = (id?: string) =>
    event.players.find((p) => p.id === id)?.name ?? 'Unbekannt';
  return (
    <View style={styles.event}>
      <View style={styles.dot}>
        <AppText style={styles.dotText}>
          {event.action === 'created'
            ? '+'
            : event.action === 'deleted'
              ? '−'
              : '↺'}
        </AppText>
      </View>
      <View style={styles.eventBody}>
        <AppText style={styles.eventTitle}>
          {event.action === 'created'
            ? 'Spiel erfasst'
            : event.action === 'deleted'
              ? 'Spiel gelöscht'
              : event.action === 'restored'
                ? 'Spiel wiederhergestellt'
                : 'Spiel geändert'}
        </AppText>
        <AppText style={styles.note}>
          {event.actor.name} ·{' '}
          {new Date(event.occurredAt).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </AppText>
        {showGame ? (
          <AppText style={styles.gameLabel}>
            {formatRoundGameType(round.gameType, round.suit)} ·{' '}
            {new Date(round.createdAt).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </AppText>
        ) : null}
        <View style={styles.changes}>
          {diffs.length ? (
            diffs.map((diff) => (
              <View
                key={diff.label}
                style={styles.diff}
                accessible
                accessibilityLabel={`${diff.label}: ${diff.before} wird ${diff.after}`}
              >
                <AppText style={styles.diffLabel}>{diff.label}</AppText>
                <View style={styles.values}>
                  <AppText style={styles.old}>{diff.before}</AppText>
                  <AppText style={styles.note}> → </AppText>
                  <AppText style={styles.new}>{diff.after}</AppText>
                </View>
              </View>
            ))
          ) : (
            <AppText style={styles.note}>
              {formatRoundGameType(round.gameType, round.suit)}
              {round.declarerId ? ` · Ansager ${name(round.declarerId)}` : ''}
              {event.action === 'deleted'
                ? ' · aus der Abrechnung entfernt'
                : event.action === 'updated'
                  ? ' · Rundenkontext aktualisiert'
                  : ''}
            </AppText>
          )}
          {event.action !== 'updated' ? (
            <AppText style={styles.note}>
              {roundHistorySummary(round, event.players)}
            </AppText>
          ) : null}
          {event.causeRoundId ? (
            <AppText style={styles.note}>
              Abhängige Stockbewegung durch die Änderung eines anderen Spiels
              neu berechnet.
            </AppText>
          ) : null}
          {event.action === 'updated' &&
          diffs.some((d) => d.label === 'Tarif je Spieler') ? (
            <AppText style={styles.note}>
              Betragsänderung aus dem korrigierten Tarif und Ergebnis.
            </AppText>
          ) : null}
        </View>
        {onRestore ? (
          <View style={styles.restore}>
            <GoldButton
              title="Spiel wiederherstellen"
              onPress={() => setRestoreError(onRestore())}
            />
            <AppText style={styles.note}>
              Salden und Stock werden neu berechnet. Der Verlauf bleibt
              erhalten.
            </AppText>
            {restoreError ? (
              <AppText accessibilityRole="alert" style={styles.note}>
                {restoreError}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    padding: authSpacing.lg,
  },
  back: {
    width: authControlSizes.touch,
    minHeight: authControlSizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 32, color: authColors.textPrimary },
  headerCopy: { flex: 1, minWidth: 0, gap: authSpacing.xs },
  title: { fontSize: 21, fontWeight: '600', color: authColors.textPrimary },
  content: {
    padding: authSpacing.lg,
    gap: authSpacing.xl,
    paddingBottom: authSpacing.xxl,
  },
  current: {
    padding: authSpacing.lg,
    gap: authSpacing.sm,
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.sm,
  },
  currentText: {
    color: authColors.goldHighlight,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  note: { color: authColors.textSecondary, fontSize: 13, lineHeight: 19 },
  event: { flexDirection: 'row', gap: authSpacing.md },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: authColors.goldHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: authColors.onGold, fontSize: 20 },
  eventBody: { flex: 1, minWidth: 0, gap: authSpacing.xs },
  restore: { gap: authSpacing.sm, marginTop: authSpacing.md },
  eventTitle: { fontSize: 17, fontWeight: '600' },
  gameLabel: { fontSize: 13, color: authColors.goldHighlight },
  changes: {
    marginTop: authSpacing.sm,
    padding: authSpacing.md,
    gap: authSpacing.md,
    backgroundColor: authColors.surface,
    borderRadius: authRadius.sm,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
  },
  diff: { gap: authSpacing.xs },
  diffLabel: { fontSize: 13, color: authColors.textPrimary },
  values: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  old: { fontSize: 15, color: authColors.textSecondary, flexShrink: 1 },
  new: {
    fontSize: 15,
    color: authColors.goldHighlight,
    fontWeight: '600',
    flexShrink: 1,
  },
  footer: {
    fontSize: 13,
    lineHeight: 19,
    color: authColors.textSecondary,
    paddingTop: authSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: authColors.borderSoft,
  },
  empty: {
    color: authColors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    paddingVertical: authSpacing.xl,
  },
});
