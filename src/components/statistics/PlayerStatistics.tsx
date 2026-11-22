import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { authColors, authInteraction, authSpacing } from '../../theme';
import { authTypography } from '../../theme/typography';
import {
  type StatisticsEntry,
  type StatisticsRound,
  summarizePlayPositions,
  summarizeStatistics,
} from '../../utils/statistics';
import { AppIcon } from '../ui/AppIcon';
import { AppText } from '../ui/AppText';
import { PersonalBalanceOverview } from './PersonalBalanceOverview';
import {
  average,
  BonusStatistics,
  GameTypeStatistics,
  money,
  rate,
  StatHeading,
  StatNote,
  StatPanel,
} from './StatisticsPanels';

export function PlayerStatistics({
  entries,
  onOpen,
  title,
}: {
  entries: StatisticsEntry[];
  onOpen: (round: StatisticsRound) => void;
  /** Heading of the balance card, e.g. "Bilanz als Gast". */
  title?: string;
}) {
  const [detail, setDetail] = useState<'types' | 'positions'>();
  const summary = useMemo(() => summarizeStatistics(entries), [entries]);
  const playPositions = useMemo(
    () => (detail === 'positions' ? summarizePlayPositions(entries) : null),
    [detail, entries],
  );
  if (!entries.length) {
    return <StatNote>Noch keine gespielten Spiele für diese Person.</StatNote>;
  }
  return (
    <>
      <PersonalBalanceOverview
        entries={entries}
        summary={summary}
        title={title}
      />
      <View style={styles.details}>
        <DetailRow
          title="Nach Spielart"
          expanded={detail === 'types'}
          onPress={() => setDetail(detail === 'types' ? undefined : 'types')}
        />
        {detail === 'types' ? (
          <View style={styles.detailBody}>
            <GameTypeStatistics entries={entries} personal onOpen={onOpen} />
            <BonusStatistics entries={entries} />
            <StatPanel>
              <StatHeading>Weitere Kennzahlen</StatHeading>
              <StatNote>
                Selbst angesagt gewonnen · {summary.ownWins} von {summary.own} (
                {rate(summary.ownWins, summary.own)})
              </StatNote>
              <StatNote>
                Ø je Runde · {average(summary.balance, summary.count)}
              </StatNote>
              <StatNote>
                Größter Gewinn · {money(Math.max(0, summary.best ?? 0))}
              </StatNote>
              <StatNote>
                Größter Verlust · {money(Math.min(0, summary.worst ?? 0))}
              </StatNote>
            </StatPanel>
          </View>
        ) : null}
        <DetailRow
          title="Nach Spielposition"
          expanded={detail === 'positions'}
          onPress={() =>
            setDetail(detail === 'positions' ? undefined : 'positions')
          }
        />
        {playPositions ? (
          <View style={styles.detailBody}>
            {playPositions.positions.map(({ label, games, wins }) => (
              <View key={label} style={styles.position}>
                <StatHeading>{label}</StatHeading>
                <StatNote>
                  {games
                    ? `${wins} von ${games} gewonnen · ${rate(wins, games)}`
                    : 'Keine Spiele auf dieser Position'}
                </StatNote>
              </View>
            ))}
            {playPositions.unknown ? (
              <StatNote>
                {playPositions.unknown === 1
                  ? 'Position bei einem Spiel unbekannt'
                  : `Position bei ${playPositions.unknown} Spielen unbekannt`}
              </StatNote>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );
}

function DetailRow({
  title,
  expanded,
  onPress,
}: {
  title: string;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.detailRow,
        pressed && authInteraction.pressed,
      ]}
    >
      <AppText style={styles.detailTitle}>{title}</AppText>
      {expanded ? (
        <AppIcon icon={ChevronDown} color={authColors.goldHighlight} />
      ) : (
        <AppIcon icon={ChevronRight} color={authColors.goldHighlight} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: authColors.listSeparator,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: authSpacing.sm,
    minHeight: 54,
    paddingVertical: authSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: authColors.listSeparator,
  },
  detailTitle: {
    flexShrink: 1,
    fontSize: authTypography.button,
    fontWeight: '700',
  },
  detailBody: { gap: authSpacing.md, paddingVertical: authSpacing.lg },
  position: { gap: authSpacing.xs, paddingVertical: authSpacing.xs },
});
