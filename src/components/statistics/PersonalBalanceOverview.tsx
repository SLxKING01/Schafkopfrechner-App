import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { authColors, authSpacing } from '../../theme';
import { authTypography } from '../../theme/typography';
import type {
  StatisticsEntry,
  StatisticsSummary,
} from '../../utils/statistics';
import { AppText } from '../ui/AppText';
import { money, rate } from './StatisticsPanels';

const dateLabel = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
});

function balanceDays(entries: StatisticsEntry[]) {
  const totals = new Map<number, number>();
  let undated = 0;
  for (const { round, playerId } of entries) {
    if (!playerId) continue;
    const change = round.deltas[playerId] ?? 0;
    const day = new Date(round.createdAt).setHours(0, 0, 0, 0);
    if (!Number.isFinite(day)) {
      undated++;
      continue;
    }
    totals.set(day, (totals.get(day) ?? 0) + change);
  }
  let balance = 0;
  const days = [...totals]
    .sort(([a], [b]) => a - b)
    .map(([day, change]) => {
      balance += change;
      return { day, change, balance };
    });
  return { days, undated };
}

export function PersonalBalanceOverview({
  entries,
  summary,
  title = 'Spielbilanz',
}: {
  entries: StatisticsEntry[];
  summary: StatisticsSummary;
  title?: string;
}) {
  const { days, undated } = useMemo(() => balanceDays(entries), [entries]);
  const [selectedDay, setSelectedDay] = useState<number>();
  const [width, setWidth] = useState(340);
  const last = days.at(-1);
  const selectedIndex = days.findIndex(({ day }) => day === selectedDay);
  const point = days[selectedIndex] ?? last;
  const index = selectedIndex < 0 ? days.length - 1 : selectedIndex;
  const left = Math.min(66, width / 3);
  const right = Math.max(left + 1, width - 9);
  const first = days[0]?.day ?? 0;
  const start = first - 86400000;
  const duration = Math.max(1, (last?.day ?? first) - start);
  const x = (day: number) => left + ((day - start) / duration) * (right - left);
  const low = days.reduce((min, { balance }) => Math.min(min, balance), 0);
  const high = days.reduce((max, { balance }) => Math.max(max, balance), 0);
  const padding = Math.max(1, (high - low) * 0.08);
  const y = (cents: number) =>
    8 + ((high + padding - cents) / (high - low + 2 * padding)) * 136;
  const dates = days.length > 1 ? [days[0], last!] : last ? [last] : [];
  const annotation = point
    ? point.day === last?.day
      ? 'Letzter Spieltag'
      : dateLabel.format(point.day)
    : '';

  function selectNearest(offset: number) {
    let nearest = 0;
    for (let i = 1; i < days.length; i++) {
      if (
        Math.abs(x(days[i].day) - offset) <=
        Math.abs(x(days[nearest].day) - offset)
      )
        nearest = i;
    }
    setSelectedDay(days[nearest]?.day);
  }

  return (
    <View style={s.container}>
      <View style={s.headline}>
        <AppText accessibilityRole="header" style={s.heading}>
          {title}
        </AppText>
        <AppText
          selectable
          style={[s.balance, summary.balance < 0 && s.negative]}
        >
          {money(summary.balance)}
        </AppText>
      </View>
      {point ? (
        <View style={s.chart}>
          <View style={s.annotation} accessibilityLiveRegion="polite">
            <AppText style={s.annotationLabel}>
              {annotation}{' '}
              <AppText style={s.annotationValue}>{money(point.change)}</AppText>
            </AppText>
          </View>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="Spielbilanz im Verlauf"
            accessibilityValue={{
              text: `${dateLabel.format(point.day)}, kumuliert ${money(point.balance)}, Spieltag ${money(point.change)}`,
            }}
            accessibilityActions={[
              { name: 'decrement' },
              { name: 'increment' },
            ]}
            onAccessibilityAction={({ nativeEvent }) => {
              const offset = nativeEvent.actionName === 'increment' ? 1 : -1;
              setSelectedDay(
                days[Math.max(0, Math.min(days.length - 1, index + offset))]
                  .day,
              );
            }}
            onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
            onPress={({ nativeEvent }) => selectNearest(nativeEvent.locationX)}
          >
            <View pointerEvents="none" accessible={false}>
              <Svg
                width="100%"
                height={174}
                viewBox={`0 0 ${width} 174`}
                accessible={false}
              >
                <Line
                  x1={left}
                  x2={right}
                  y1={y(0)}
                  y2={y(0)}
                  stroke={authColors.textSecondary}
                  strokeDasharray="3 4"
                />
                <Line
                  x1={x(point.day)}
                  x2={x(point.day)}
                  y1={y(point.balance)}
                  y2={147}
                  stroke={authColors.borderGold}
                  strokeDasharray="3 4"
                />
                {[
                  0,
                  ...[high, low].filter(
                    (value) => Math.abs(y(value) - y(0)) >= 15,
                  ),
                ].map((value) => (
                  <SvgText
                    key={value}
                    x={left - 8}
                    y={y(value) + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill={authColors.textMutedGreen}
                  >
                    {value === 0 ? '0 €' : money(value)}
                  </SvgText>
                ))}
                <Polyline
                  points={[
                    `${left},${y(0)}`,
                    ...days.map(
                      ({ day, balance }) => `${x(day)},${y(balance)}`,
                    ),
                  ].join(' ')}
                  stroke={authColors.goldHighlight}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  fill="none"
                />
                <Circle
                  cx={x(point.day)}
                  cy={y(point.balance)}
                  r={4}
                  fill={authColors.goldHighlight}
                />
                {dates.map(({ day }, i) => (
                  <SvgText
                    key={day}
                    x={dates.length > 1 && i === 0 ? left : right}
                    y={166}
                    textAnchor={dates.length > 1 && i === 0 ? 'start' : 'end'}
                    fontSize={11}
                    fill={authColors.textMutedGreen}
                  >
                    {dateLabel.format(day)}
                  </SvgText>
                ))}
              </Svg>
            </View>
          </Pressable>
        </View>
      ) : null}
      <View style={s.summary}>
        <AppText style={s.results}>
          {summary.count} {summary.count === 1 ? 'Spiel' : 'Spiele'} ·{' '}
          {summary.wins} gewonnen{' '}
          <AppText style={s.annotationValue}>
            ({rate(summary.wins, summary.count)})
          </AppText>
        </AppText>
        <AppText style={s.note}>Ohne Stock und Zahlungen</AppText>
        {undated ? (
          <AppText style={s.note}>
            Im Verlauf fehlen {undated} {undated === 1 ? 'Spiel' : 'Spiele'}{' '}
            ohne bekanntes Datum.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: authSpacing.lg },
  headline: { gap: authSpacing.xs },
  heading: {
    fontSize: authTypography.subtitle,
    lineHeight: 29,
    fontWeight: '800',
  },
  balance: {
    color: authColors.goldHighlight,
    fontSize: authTypography.amount,
    lineHeight: 53,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  negative: { color: authColors.errorText },
  chart: { gap: authSpacing.xs },
  annotation: {
    alignSelf: 'flex-end',
    borderColor: authColors.borderSoft,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: authSpacing.sm,
    paddingVertical: authSpacing.xs,
    backgroundColor: authColors.surface,
  },
  annotationLabel: { fontSize: authTypography.control },
  annotationValue: {
    color: authColors.goldHighlight,
    fontSize: authTypography.label,
    fontWeight: '800',
  },
  summary: { gap: authSpacing.xs },
  results: {
    fontSize: authTypography.button,
    lineHeight: 24,
    fontWeight: '800',
  },
  note: {
    fontSize: authTypography.caption,
    lineHeight: 19,
    color: authColors.textMutedGreen,
  },
});
