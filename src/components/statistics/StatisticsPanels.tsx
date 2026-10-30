import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import {
  authColors as c,
  authControlSizes,
  authInteraction,
  authRadius as radius,
  authSpacing as space,
  authTextStyles,
} from '../../theme';
import { cardSuits, formatRoundGameType } from '../../utils/cardSuits';
import { formatOverviewMoney } from '../../utils/gameOverview';
import {
  groupStatistics,
  sauspielTeams,
  type StatisticsEntry,
  type StatisticsRound,
  type StatisticsTable,
  summarizeStatistics,
  tableTrend,
} from '../../utils/statistics';
import { CardSuitIcon } from '../game/CardSuitIcon';
import { AppText } from '../ui/AppText';

export const money = (n: number) =>
  `${n > 0 ? '+' : ''}${formatOverviewMoney(n)}`;
export const rate = (n: number, total: number) =>
  total
    ? `${((n / total) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })}\u00a0%`
    : '–';
export const average = (n: number, total: number) =>
  total ? money(Math.sign(n) * Math.round(Math.abs(n / total))) : '–';
const roundCount = (n: number) => `${n} ${n === 1 ? 'Runde' : 'Runden'}`;

export function StatAction({
  children,
  onPress,
  selected = false,
  label,
  disabled = false,
}: {
  children: ReactNode;
  onPress: () => void;
  selected?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        selected && s.selected,
        pressed && authInteraction.pressed,
        disabled && authInteraction.disabled,
      ]}
    >
      <AppText style={[s.actionText, selected && s.selectedText]}>
        {children}
      </AppText>
    </Pressable>
  );
}
export function StatPanel({ children }: { children: ReactNode }) {
  return <View style={s.panel}>{children}</View>;
}
export function StatHeading({ children }: { children: ReactNode }) {
  return (
    <AppText accessibilityRole="header" style={s.heading}>
      {children}
    </AppText>
  );
}
export function StatNote({ children }: { children: ReactNode }) {
  return <AppText style={s.note}>{children}</AppText>;
}
export function Money({ value }: { value: number }) {
  return (
    <AppText
      style={[
        s.numeric,
        {
          color:
            value < 0 ? c.error : value > 0 ? c.accentGreen : c.textPrimary,
        },
      ]}
    >
      {money(value)}
    </AppText>
  );
}
export function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <View style={s.metric}>
      <StatNote>{label}</StatNote>
      <AppText
        selectable
        style={[
          s.value,
          tone && { color: tone === 'positive' ? c.accentGreen : c.error },
        ]}
      >
        {value}
      </AppText>
      {detail ? <StatNote>{detail}</StatNote> : null}
    </View>
  );
}
function PersonalTypeTrend({ entries }: { entries: StatisticsEntry[] }) {
  const values = useMemo(() => {
    const ordered = [...entries].sort(
      (a, b) =>
        Date.parse(a.round.createdAt) - Date.parse(b.round.createdAt) ||
        a.round.key.localeCompare(b.round.key),
    );
    const out = [0];
    for (const e of ordered)
      out.push(
        out[out.length - 1] +
          (e.playerId ? (e.round.deltas[e.playerId] ?? 0) : 0),
      );
    return out;
  }, [entries]);
  const low = values.reduce((a, b) => Math.min(a, b), 0),
    high = values.reduce((a, b) => Math.max(a, b), 0),
    span = Math.max(100, high - low);
  const y = (v: number) => 8 + ((high - v) / span) * 70;
  return (
    <>
      <StatHeading>Bilanz dieser Spielart</StatHeading>
      <StatNote>
        {roundCount(entries.length)} in zeitlicher Reihenfolge ·{' '}
        {money(values.at(-1) ?? 0)}
      </StatNote>
      <Svg
        width="100%"
        height={108}
        viewBox="0 0 320 108"
        accessibilityRole="image"
        accessibilityLabel={`Bilanzverlauf: ${values.map(money).join(', ')}`}
      >
        <Line
          x1={8}
          x2={312}
          y1={y(0)}
          y2={y(0)}
          stroke={c.textSecondary}
          strokeDasharray="3 3"
        />
        <Polyline
          points={values
            .map(
              (v, i) =>
                `${8 + (i / Math.max(1, values.length - 1)) * 304},${y(v)}`,
            )
            .join(' ')}
          stroke={c.goldHighlight}
          strokeWidth={2}
          fill="none"
        />
        <SvgText x={8} y={102} fontSize={11} fill={c.textSecondary}>
          Start
        </SvgText>
        <SvgText
          x={312}
          y={102}
          textAnchor="end"
          fontSize={11}
          fill={c.textSecondary}
        >
          {money(values.at(-1) ?? 0)}
        </SvgText>
      </Svg>
    </>
  );
}
export function BonusStatistics({ entries }: { entries: StatisticsEntry[] }) {
  const stats = summarizeStatistics(entries);
  return (
    <StatPanel>
      <StatHeading>Leger, Kontra und Re</StatHeading>
      <StatNote>
        {stats.bonusKnown} von {stats.count} Runden mit bekannten Bonusdaten
      </StatNote>
      {[
        ['Mit Leger', stats.leger, stats.bonusKnown],
        ['Mit Kontra', stats.kontra, stats.bonusKnown],
        ['Davon mit Re', stats.re, stats.kontra],
      ].map(([label, n, total]) => (
        <View key={String(label)} style={s.row}>
          <AppText>{label}</AppText>
          <AppText style={s.numeric}>
            {n}/{total} · {rate(Number(n), Number(total))}
          </AppText>
        </View>
      ))}
      <StatNote>
        Rundenwerte, keine persönliche Ansagequote. Re ist eine Teilmenge von
        Kontra.
      </StatNote>
    </StatPanel>
  );
}
function SummaryRow({
  label,
  entries,
  personal,
}: {
  label: string;
  entries: StatisticsEntry[];
  personal: boolean;
}) {
  const stats = summarizeStatistics(entries);
  return (
    <View style={s.row}>
      <View style={s.copy}>
        <AppText>{label}</AppText>
        <StatNote>
          {roundCount(stats.count)} · {stats.wins}/{stats.knownResults} gewonnen
          · {rate(stats.wins, stats.knownResults)}
        </StatNote>
      </View>
      <View style={s.right}>
        {personal ? (
          <Money value={stats.balance} />
        ) : (
          <AppText style={s.numeric}>
            {formatOverviewMoney(stats.value)}
          </AppText>
        )}
        <StatNote>
          Ø{' '}
          {personal
            ? average(stats.balance, stats.count)
            : stats.count
              ? formatOverviewMoney(Math.round(stats.value / stats.count))
              : '–'}
        </StatNote>
      </View>
    </View>
  );
}
export function RoundLinks({
  entries,
  onOpen,
}: {
  entries: StatisticsEntry[];
  onOpen: (round: StatisticsRound) => void;
}) {
  const [limit, setLimit] = useState(10);
  return (
    <>
      {entries.slice(0, limit).map(({ round: r, playerId }) => (
        <Pressable
          key={r.key}
          accessibilityRole="button"
          accessibilityLabel={`${formatRoundGameType(r.type, r.suit)} öffnen`}
          onPress={() => onOpen(r)}
          style={({ pressed }) => [s.row, pressed && authInteraction.pressed]}
        >
          <View style={s.copy}>
            <AppText>{formatRoundGameType(r.type, r.suit)}</AppText>
            <StatNote>{new Date(r.createdAt).toLocaleString('de-DE')}</StatNote>
          </View>
          {playerId ? (
            <Money value={r.deltas[playerId] ?? 0} />
          ) : (
            <AppText>{formatOverviewMoney(r.cents)}</AppText>
          )}
        </Pressable>
      ))}
      {entries.length > limit ? (
        <StatAction onPress={() => setLimit(limit + 20)}>
          Weitere Spiele anzeigen
        </StatAction>
      ) : null}
    </>
  );
}
export function GameTypeStatistics({
  entries,
  personal,
  onOpen,
}: {
  entries: StatisticsEntry[];
  personal: boolean;
  onOpen: (round: StatisticsRound) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const groups = useMemo(
    () => groupStatistics(entries, (r) => r.type),
    [entries],
  );
  return (
    <>
      <StatHeading>Spielarten und Kartenfarben</StatHeading>
      <StatNote>
        {personal
          ? 'Alle beteiligten Spiele. Details trennen Ansager, Partner und Gegenpartei.'
          : 'Gewinnquote der ansagenden Partei, soweit der Ansager bekannt ist. Spielwert = Gesamtgewinn der Gewinnerpartei, ohne Stock.'}
      </StatNote>
      {groups.map((g) => (
        <StatPanel key={g.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${formatRoundGameType(g.id)} auswerten`}
            accessibilityState={{ expanded: expanded === g.id }}
            onPress={() => setExpanded(expanded === g.id ? null : g.id)}
            style={({ pressed }) => [s.row, pressed && authInteraction.pressed]}
          >
            <View style={s.copy}>
              <AppText style={s.bold}>
                {formatRoundGameType(g.id)} {expanded === g.id ? '−' : '+'}
              </AppText>
              <StatNote>
                {roundCount(g.summary.count)} · {g.summary.wins}/
                {g.summary.knownResults} gewonnen ·{' '}
                {rate(g.summary.wins, g.summary.knownResults)}
              </StatNote>
            </View>
            <View style={s.right}>
              {personal ? (
                <Money value={g.summary.balance} />
              ) : (
                <AppText style={s.numeric}>
                  {formatOverviewMoney(g.summary.value)}
                </AppText>
              )}
              <StatNote>
                Ø{' '}
                {personal
                  ? average(g.summary.balance, g.summary.count)
                  : formatOverviewMoney(
                      Math.round(g.summary.value / g.summary.count),
                    )}
              </StatNote>
            </View>
          </Pressable>
          {expanded === g.id ? (
            <>
              <StatNote>
                {personal
                  ? 'Spielbilanz und Durchschnitt je beteiligter Runde'
                  : 'Spielwerte gesamt und Durchschnitt je Runde'}
                . Quote basiert auf {g.summary.knownResults}/{g.summary.count}{' '}
                auswertbaren Runden.
              </StatNote>
              {personal ? (
                <>
                  <StatHeading>Deine Rolle</StatHeading>
                  {groupStatistics(g.entries, (r, id) => {
                    return !r.declarerId
                      ? 'Unbekannt'
                      : r.declarerId === id
                        ? 'Selbst angesagt'
                        : r.partnerId === id
                          ? 'Als Partner'
                          : 'Als Gegenpartei';
                  }).map((role) => (
                    <SummaryRow
                      key={role.id}
                      label={role.id}
                      entries={role.entries}
                      personal
                    />
                  ))}
                </>
              ) : null}
              {personal ? <PersonalTypeTrend entries={g.entries} /> : null}
              <StatHeading>Kartenfarben</StatHeading>
              {groupStatistics(g.entries, (r) => r.suit ?? 'unknown').map(
                (color) => {
                  const suit = cardSuits.find((x) => x.id === color.id);
                  return (
                    <View key={color.id}>
                      <View style={s.inline}>
                        {suit ? (
                          <CardSuitIcon
                            suit={suit.id}
                            color={suit.color}
                            size={24}
                          />
                        ) : null}
                        <AppText style={s.bold}>
                          {suit?.label ?? 'Nicht erfasst / ohne Farbe'}
                        </AppText>
                      </View>
                      <SummaryRow
                        label={formatRoundGameType(g.id, suit?.id)}
                        entries={color.entries}
                        personal={personal}
                      />
                    </View>
                  );
                },
              )}
              <StatNote>
                Eine Kartenfarbe wird nur aus der gespeicherten Auswahl gelesen.
                Fehlende Angaben werden nicht geraten.
              </StatNote>
              <StatHeading>Einzelspiele</StatHeading>
              <RoundLinks entries={g.entries} onOpen={onOpen} />
            </>
          ) : null}
        </StatPanel>
      ))}
    </>
  );
}
const lineColors = [c.goldHighlight, c.accentGreen, c.error, c.textPrimary];
export function TableStatisticsPanel({
  table,
  onOpen,
}: {
  table: StatisticsTable;
  onOpen: (round: StatisticsRound) => void;
}) {
  const trend = useMemo(() => tableTrend(table), [table]);
  const partners = useMemo(() => sauspielTeams(table), [table]);
  const [selected, setSelected] = useState<number | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [sort, setSort] = useState<'count' | 'wins' | 'balance'>('count');
  const [width, setWidth] = useState(320);
  const [axis, setAxis] = useState<'round' | 'time'>('round');
  const index = Math.min(selected ?? table.rounds.length, table.rounds.length);
  const point = trend.points[index];
  const vals = trend.points.flatMap((p) => Object.values(p.balances));
  const low = Math.min(0, ...vals),
    high = Math.max(0, ...vals),
    span = Math.max(100, high - low);
  const y = (v: number) => 16 + ((high - v) / span) * 148;
  const timestamps = table.rounds.map((r) => Date.parse(r.createdAt));
  const validTime =
    timestamps.length > 1 &&
    timestamps.every(
      (t, i) => Number.isFinite(t) && (i === 0 || t > timestamps[i - 1]),
    );
  const timeAxis = axis === 'time' && validTime;
  const firstTime = timestamps[0] ?? 0,
    lastTime = timestamps.at(-1) ?? firstTime;
  const x = (i: number) =>
    42 +
    (timeAxis && i > 0
      ? (timestamps[i - 1] - firstTime) / Math.max(1, lastTime - firstTime)
      : i / Math.max(1, table.rounds.length)) *
      268;
  const teams = [...partners.teams].sort((a, b) =>
    sort === 'count'
      ? b.summary.count - a.summary.count
      : sort === 'balance'
        ? b.balance - a.balance
        : b.wins / b.summary.count - a.wins / a.summary.count ||
          b.summary.count - a.summary.count,
  );
  const selectedTeam = teams.find((t) => t.id === team);
  const maxRound = table.rounds.reduce<StatisticsRound | null>(
    (best, r) => (!best || r.cents > best.cents ? r : best),
    null,
  );
  return (
    <>
      <StatHeading>{table.name}</StatHeading>
      <StatNote>
        {table.rounds.length} gespielte Runden · {table.stockBookings} separate
        Stockbuchungen
      </StatNote>
      {!table.rounds.length ? (
        <StatPanel>
          <AppText>Noch keine gespielten Runden an diesem Tisch.</AppText>
        </StatPanel>
      ) : (
        <>
          <StatPanel>
            <StatHeading>Saldoverlauf</StatHeading>
            <View style={s.inline}>
              <StatAction
                selected={axis === 'round'}
                onPress={() => setAxis('round')}
              >
                Runden
              </StatAction>
              <StatAction
                disabled={!validTime}
                selected={timeAxis}
                onPress={() => setAxis('time')}
              >
                Uhrzeit
              </StatAction>
            </View>
            <StatNote>
              Reine Spielergebnisse; Stock und Zahlungen verändern die Kurven
              nicht. Uhrzeiten sind Erfassungszeiten.
            </StatNote>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Saldoverlauf: Runde durch Antippen auswählen"
              onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
              onPress={(e) => {
                const value =
                  (e.nativeEvent.locationX / Math.max(1, width)) * 320;
                let nearest = 0;
                for (let i = 1; i < trend.points.length; i++)
                  if (Math.abs(x(i) - value) <= Math.abs(x(nearest) - value))
                    nearest = i;
                setSelected(nearest);
              }}
            >
              <Svg
                width="100%"
                height={190}
                viewBox="0 0 320 190"
                accessible={false}
              >
                <Line
                  x1={42}
                  x2={310}
                  y1={y(0)}
                  y2={y(0)}
                  stroke={c.textSecondary}
                  strokeDasharray="3 3"
                />
                {[high, low]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((v) => (
                    <SvgText
                      key={v}
                      x={0}
                      y={y(v) + 4}
                      fontSize={10}
                      fill={c.textSecondary}
                    >
                      {(v / 100).toLocaleString('de-DE')} €
                    </SvgText>
                  ))}
                {table.players.map((p, i) => (
                  <Polyline
                    key={p.id}
                    points={trend.points
                      .map((pt, j) => `${x(j)},${y(pt.balances[p.id])}`)
                      .join(' ')}
                    stroke={lineColors[i % lineColors.length]}
                    fill="none"
                    strokeWidth={2}
                    strokeDasharray={i >= 4 ? '4 3' : undefined}
                  />
                ))}
                <Line
                  x1={x(index)}
                  x2={x(index)}
                  y1={12}
                  y2={168}
                  stroke={c.borderGold}
                />
                {table.players.map((p, i) => (
                  <Circle
                    key={p.id}
                    cx={x(index)}
                    cy={y(point.balances[p.id])}
                    r={3}
                    fill={lineColors[i % lineColors.length]}
                  />
                ))}
                <SvgText x={42} y={186} fontSize={11} fill={c.textSecondary}>
                  {timeAxis
                    ? new Date(firstTime).toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Start'}
                </SvgText>
                <SvgText
                  x={310}
                  y={186}
                  textAnchor="end"
                  fontSize={11}
                  fill={c.textSecondary}
                >
                  {timeAxis
                    ? new Date(lastTime).toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : `Runde ${table.rounds.length}`}
                </SvgText>
              </Svg>
            </Pressable>
            <View style={s.inline}>
              <StatAction
                label="Vorherige Runde im Trend"
                disabled={index === 0}
                onPress={() => setSelected(index - 1)}
              >
                ‹
              </StatAction>
              <AppText>Stand nach Runde {index}</AppText>
              <StatAction
                label="Nächste Runde im Trend"
                disabled={index === table.rounds.length}
                onPress={() => setSelected(index + 1)}
              >
                ›
              </StatAction>
            </View>
            <View accessibilityLiveRegion="polite">
              {table.players.map((p, i) => (
                <View key={p.id} style={s.row}>
                  <AppText style={{ color: lineColors[i % lineColors.length] }}>
                    {p.name}
                  </AppText>
                  <Money value={point.balances[p.id]} />
                </View>
              ))}
            </View>
            {point.source ? (
              <>
                <StatNote>
                  {new Date(point.source.createdAt).toLocaleString('de-DE')} ·{' '}
                  {formatRoundGameType(point.source.type, point.source.suit)} ·
                  Gewinner:{' '}
                  {point.source.winners
                    .map(
                      (id) =>
                        table.players.find((p) => p.id === id)?.name ??
                        'Unbekannt',
                    )
                    .join(' & ')}
                </StatNote>
                <StatAction onPress={() => onOpen(point.source!)}>
                  Ausgewähltes Spiel öffnen
                </StatAction>
              </>
            ) : null}
          </StatPanel>
          <StatPanel>
            <StatHeading>Spielstände und Wendepunkte</StatHeading>
            <StatNote>
              Aktuell · Höchststand · Tiefststand (ohne Stock)
            </StatNote>
            {table.players.map((p) => (
              <View key={p.id} style={s.row}>
                <View style={s.copy}>
                  <AppText style={s.bold}>{p.name}</AppText>
                  <StatNote>
                    Hoch {money(trend.highs[p.id])} · Tief{' '}
                    {money(trend.lows[p.id])}
                  </StatNote>
                  <StatNote>
                    Größter Gewinnsprung{' '}
                    {money(
                      Math.max(
                        0,
                        ...table.rounds.map((r) => r.deltas[p.id] ?? 0),
                      ),
                    )}
                  </StatNote>
                </View>
                <Money value={trend.balances[p.id]} />
              </View>
            ))}
            <StatNote>
              {trend.leadChanges} Führungswechsel zwischen allein Führenden.
              Gleichstände zählen nicht als Wechsel.
            </StatNote>
            {maxRound ? (
              <StatAction onPress={() => onOpen(maxRound)}>
                Teuerstes Spiel:{' '}
                {formatRoundGameType(maxRound.type, maxRound.suit)} ·{' '}
                {formatOverviewMoney(maxRound.cents)}
              </StatAction>
            ) : null}
          </StatPanel>
          <StatPanel>
            <StatHeading>Sauspiel-Partnerschaften</StatHeading>
            <StatNote>
              {partners.known}/{partners.total} Sauspiele mit bekanntem Ansager
              und Partner. Nur diese Teams zählen, nicht die Gegenpartei.
            </StatNote>
            <View style={s.inline}>
              <StatAction
                selected={sort === 'count'}
                onPress={() => setSort('count')}
              >
                Häufigkeit
              </StatAction>
              <StatAction
                selected={sort === 'wins'}
                onPress={() => setSort('wins')}
              >
                Quote
              </StatAction>
              <StatAction
                selected={sort === 'balance'}
                onPress={() => setSort('balance')}
              >
                Bilanz
              </StatAction>
            </View>
            {!teams.length ? (
              <StatNote>Noch keine auswertbaren Partnerschaften.</StatNote>
            ) : (
              teams.map((t) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: team === t.id }}
                  accessibilityLabel={`Partnerschaft ${t.ids.map((id) => table.players.find((p) => p.id === id)?.name).join(' und ')} öffnen`}
                  onPress={() => setTeam(team === t.id ? null : t.id)}
                  style={({ pressed }) => [
                    s.row,
                    pressed && authInteraction.pressed,
                  ]}
                >
                  <View style={s.copy}>
                    <AppText>
                      {t.ids
                        .map(
                          (id) =>
                            table.players.find((p) => p.id === id)?.name ??
                            'Unbekannt',
                        )
                        .join(' & ')}
                    </AppText>
                    <StatNote>
                      {t.summary.count} gemeinsam · {t.wins}/{t.summary.count}{' '}
                      gewonnen · {rate(t.wins, t.summary.count)}
                    </StatNote>
                  </View>
                  <Money value={t.balance} />
                </Pressable>
              ))
            )}
            <StatNote>
              Teambilanz = Summe beider Partner. Kleine Stichproben sind kein
              verlässliches Ranking.
            </StatNote>
            {selectedTeam ? (
              <>
                <StatHeading>Gemeinsame Spiele nach Farbe</StatHeading>
                {groupStatistics(
                  selectedTeam.entries,
                  (r) => r.suit ?? 'unknown',
                ).map((g) => (
                  <StatNote key={g.id}>
                    {cardSuits.find((suit) => suit.id === g.id)?.label ??
                      'Nicht erfasst'}
                    : {g.summary.count} Spiele · {g.summary.wins}/
                    {g.summary.knownResults} gewonnen
                  </StatNote>
                ))}
                <RoundLinks
                  key={selectedTeam.id}
                  entries={selectedTeam.entries}
                  onOpen={onOpen}
                />
              </>
            ) : null}
          </StatPanel>
          <GameTypeStatistics
            entries={table.rounds.map((round) => ({ round }))}
            personal={false}
            onOpen={onOpen}
          />
          <BonusStatistics entries={table.rounds.map((round) => ({ round }))} />
        </>
      )}
    </>
  );
}
const s = StyleSheet.create({
  panel: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surfaceElevated,
    gap: space.sm,
  },
  heading: {
    ...authTextStyles.subtitle,
    color: c.textPrimary,
    marginTop: space.sm,
  },
  note: { ...authTextStyles.caption, color: c.textSecondary, lineHeight: 18 },
  action: {
    minHeight: authControlSizes.touch,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: c.borderGold,
    borderRadius: radius.sm,
  },
  selected: { backgroundColor: c.goldHighlight },
  actionText: {
    ...authTextStyles.caption,
    color: c.goldHighlight,
    fontWeight: '700',
  },
  selectedText: { color: c.onGold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minHeight: authControlSizes.touch,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  right: { alignItems: 'flex-end', flexShrink: 1 },
  metric: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 130,
    backgroundColor: c.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.borderGold,
    padding: space.lg,
    gap: space.xs,
  },
  value: {
    ...authTextStyles.title,
    color: c.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  numeric: {
    ...authTextStyles.label,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  bold: { fontWeight: '700' },
});
