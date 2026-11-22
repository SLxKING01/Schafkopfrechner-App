import { BarChart3, Check, ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { PlayerStatistics } from '../../components/statistics/PlayerStatistics';
import {
  StatAction,
  StatHeading,
  StatNote,
  StatPanel,
} from '../../components/statistics/StatisticsPanels';
import { TableStatisticsView } from '../../components/statistics/TableStatisticsView';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { InteractionSheet } from '../../components/ui/InteractionSheet';
import { PageHeader } from '../../components/ui/PageHeader';
import { useGameOverview } from '../../hooks/useGameOverview';
import { useOverviewNavigation } from '../../hooks/useOverviewNavigation';
import { useAuthStore } from '../../store/authStore';
import {
  authColors,
  authControlSizes,
  authInteraction,
  authSpacing,
} from '../../theme';
import { authTypography } from '../../theme/typography';
import { dashboardPersonal } from '../../utils/dashboardPersonal';
import type { StatisticsRound } from '../../utils/statistics';

const periods = [
  { id: 'month', label: '30 Tage', title: 'Letzte 30 Tage' },
  { id: 'all', label: 'Gesamter Zeitraum', title: 'Gesamter Zeitraum' },
] as const;

type Period = (typeof periods)[number]['id'];

export function StatisticsScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const overview = useGameOverview();
  const { openTables, openStatisticsRound } = useOverviewNavigation();
  const [tableId, setTableId] = useState<string>();
  const [period, setPeriod] = useState<Period>('month');
  const [picker, setPicker] = useState<'scope' | 'period'>();
  const tables = overview.statisticsTables;
  const personal = useMemo(
    () => dashboardPersonal(tables, userId),
    [tables, userId],
  );
  const table = tables.find((item) => item.id === tableId);
  const since = new Date(overview.asOf);
  since.setDate(since.getDate() - 29);
  const cutoff = since.getTime();
  const entries = useMemo(
    () =>
      personal.entries.filter(
        ({ round }) =>
          period === 'all' || Date.parse(round.createdAt) >= cutoff,
      ),
    [cutoff, period, personal.entries],
  );

  function selectTable(id?: string) {
    setTableId(id);
    setPicker(undefined);
  }

  function changePeriod(next: Period) {
    setPeriod(next);
    setPicker(undefined);
  }

  function openRound(round: StatisticsRound) {
    const source = tables.find((item) => item.id === round.tableKey);
    if (source) openStatisticsRound(source, round);
  }

  const header = (
    <View style={styles.header}>
      <PageHeader title="Statistik" />
      <AppText style={styles.subtitle}>
        {table ? 'Wie lief dieser Spielabend?' : 'Wie lief es für mich?'}
      </AppText>
    </View>
  );
  const filters = tables.length ? (
    <View style={styles.filters}>
      <FilterField
        label="Auswertung auswählen"
        value={table?.name ?? 'Mein Spiel'}
        expanded={picker === 'scope'}
        onPress={() => setPicker('scope')}
      />
      <FilterField
        label="Zeitraum auswählen"
        value={
          table
            ? periods[1].label
            : periods.find((item) => item.id === period)!.label
        }
        expanded={picker === 'period'}
        disabled={!!table}
        onPress={() => setPicker('period')}
      />
    </View>
  ) : null;

  return (
    <AuthBackground withEdgeBorder={false}>
      <ScrollView
        key={table?.id ?? 'overview'}
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          {header}
          {filters}
        </View>
        {table ? (
          <TableStatisticsView
            key={table.id}
            table={table}
            onOpen={(round) => openStatisticsRound(table, round)}
          />
        ) : !personal.hasIdentity ? (
          <>
            <EmptyGameState
              icon={BarChart3}
              title="Noch keine persönliche Statistik"
              message={
                userId
                  ? 'Sobald dir ein Spielerplatz am Tisch zugeordnet ist, siehst du hier deine Spiele.'
                  : 'Starte einen Tisch, an dem du selbst mitspielst. Deine Spiele erscheinen dann hier.'
              }
            />
            <StatAction onPress={openTables}>Zu deinen Tischen</StatAction>
          </>
        ) : !entries.length ? (
          <StatPanel>
            <StatHeading>Keine Spiele im gewählten Zeitraum</StatHeading>
            {period === 'month' && personal.entries.length > 0 ? (
              <StatAction onPress={() => changePeriod('all')}>
                Gesamten Zeitraum anzeigen
              </StatAction>
            ) : null}
          </StatPanel>
        ) : (
          <PlayerStatistics
            key={period}
            entries={entries}
            onOpen={openRound}
            title={userId ? undefined : 'Bilanz als Gast'}
          />
        )}
      </ScrollView>
      {picker ? (
        <InteractionSheet visible onClose={() => setPicker(undefined)}>
          <ScrollView contentContainerStyle={styles.picker}>
            <StatHeading>
              {picker === 'scope'
                ? 'Auswertung auswählen'
                : 'Zeitraum auswählen'}
            </StatHeading>
            {picker === 'period' ? (
              periods.map((item) => (
                <PickerRow
                  key={item.id}
                  title={item.title}
                  selected={item.id === period}
                  onPress={() => changePeriod(item.id)}
                />
              ))
            ) : (
              <>
                <PickerRow
                  title="Mein Spiel"
                  subtitle="Meine Spiele über alle zugeordneten Tische"
                  selected={!table}
                  onPress={() => selectTable()}
                />
                {tables.length ? (
                  <StatNote>Tische · vollständiger Verlauf</StatNote>
                ) : null}
                {tables.map((item) => (
                  <PickerRow
                    key={item.id}
                    title={item.name}
                    subtitle={`${item.rounds.length} ${item.rounds.length === 1 ? 'Spiel' : 'Spiele'}`}
                    selected={item.id === table?.id}
                    onPress={() => selectTable(item.id)}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </InteractionSheet>
      ) : null}
    </AuthBackground>
  );
}

function FilterField({
  label,
  value,
  expanded,
  disabled = false,
  onPress,
}: {
  label: string;
  value: string;
  expanded: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityState={{ expanded, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filter,
        pressed && authInteraction.pressed,
        disabled && authInteraction.disabled,
      ]}
    >
      <AppText style={styles.filterValue} numberOfLines={1}>
        {value}
      </AppText>
      {disabled ? null : (
        <AppIcon
          icon={ChevronDown}
          size="sm"
          color={authColors.goldHighlight}
        />
      )}
    </Pressable>
  );
}

function PickerRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickerRow,
        selected && styles.selected,
        pressed && authInteraction.pressed,
      ]}
    >
      <View style={styles.pickerText}>
        <AppText style={styles.filterValue}>{title}</AppText>
        {subtitle ? <StatNote>{subtitle}</StatNote> : null}
      </View>
      {selected ? (
        <AppIcon icon={Check} size="sm" color={authColors.goldHighlight} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: authSpacing.lgPlus,
    paddingTop: authSpacing.sm,
    paddingBottom: 120,
    gap: authSpacing.xxl,
  },
  top: { gap: authSpacing.md },
  header: { gap: authSpacing.xs },
  subtitle: {
    color: authColors.textMutedGreen,
    fontSize: authTypography.label,
    lineHeight: 21,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: authSpacing.sm },
  // Compact chips instead of two wide fields.
  filter: {
    maxWidth: '100%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.xs,
    paddingHorizontal: authSpacing.md,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    borderRadius: 999,
    backgroundColor: authColors.backgroundSoft,
  },
  filterValue: {
    flexShrink: 1,
    fontSize: authTypography.label,
    lineHeight: 19,
    fontWeight: '700',
  },
  picker: {
    paddingHorizontal: authSpacing.lgPlus,
    paddingTop: authSpacing.md,
    paddingBottom: authSpacing.xxl,
    gap: authSpacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    minHeight: authControlSizes.touch,
    padding: authSpacing.md,
    borderRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: authColors.borderSoft,
  },
  pickerText: { flex: 1, minWidth: 0 },
  selected: { backgroundColor: authColors.selectedSurface },
});
