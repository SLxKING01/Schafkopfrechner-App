import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, ReceiptText, Spade } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { DashboardSheet } from '../../components/dashboard/DashboardSheet';
import { DashboardTotals } from '../../components/dashboard/DashboardTotals';
import { SchafkopfBackdrop } from '../../components/dashboard/SchafkopfBackdrop';
import { AppText } from '../../components/ui/AppText';
import { useGameOverview } from '../../hooks/useGameOverview';
import { useOverviewNavigation } from '../../hooks/useOverviewNavigation';
import { useOwnProfile } from '../../hooks/useOwnProfile';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import {
  authColors as c,
  authControlSizes,
  authInteraction,
  authSpacing as space,
  authTextStyles,
} from '../../theme';
import { dashboardPersonal } from '../../utils/dashboardPersonal';

const RECENT_TABLES = 3;

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation();
  const overview = useGameOverview();
  const players = useGameStore((s) => s.players);
  const { openTarget, openProfile, openStatistics, openTables, createTable } =
    useOverviewNavigation();
  const [sheet, setSheet] = useState<'payments' | null>(null);
  const tables = overview.statisticsTables;
  const personal = useMemo(
    () => dashboardPersonal(tables, user?.id),
    [tables, user?.id],
  );
  const { displayName: username } = useOwnProfile();
  const signedIn = !!user?.id;
  const payments = overview.payments;
  const activeTable = overview.activeTable;
  const activeRounds =
    tables.find((t) => t.target.kind === 'active')?.rounds.length ?? 0;
  const unpaid = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        target: (typeof payments)[number]['target'];
        count: number;
      }
    >();
    for (const p of payments) {
      const key = JSON.stringify(p.target);
      const entry = map.get(key);
      if (entry) entry.count++;
      else map.set(key, { name: p.tableName, target: p.target, count: 1 });
    }
    return [...map.entries()];
  }, [payments]);
  const recent = useMemo(() => {
    const last = (rounds: { createdAt: string }[]) =>
      rounds.reduce((max, r) => Math.max(max, Date.parse(r.createdAt) || 0), 0);
    return tables
      .filter((t) => t.target.kind !== 'active')
      .map((t) => ({
        table: t,
        last: last(t.rounds),
        open: unpaid.find(([key]) => key === JSON.stringify(t.target))?.[1]
          .count,
      }))
      .sort((a, b) => b.last - a.last)
      .slice(0, RECENT_TABLES);
  }, [tables, unpaid]);
  const openLogin = () =>
    (navigation as unknown as NavigationProp<AuthStackParamList>).navigate(
      'Login',
    );
  return (
    <AuthBackground
      backgroundPattern={<SchafkopfBackdrop />}
      withEdgeBorder={false}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader username={username} onProfile={openProfile} />
        <View style={s.totals}>
          <DashboardTotals
            balance={personal.summary.balance}
            count={personal.summary.count}
            wins={personal.summary.wins}
            known={signedIn}
            caption={
              signedIn
                ? personal.summary.count
                  ? 'Über deine verknüpften Spielerkonten'
                  : 'Deine Bilanz beginnt mit dem ersten Spiel'
                : 'Melde dich an, um deine Bilanz zu speichern.'
            }
            onPress={openStatistics}
          />
          {!signedIn ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Anmelden"
              onPress={openLogin}
              hitSlop={8}
              style={({ pressed }) => [
                s.loginLink,
                pressed && authInteraction.pressed,
              ]}
            >
              <AppText style={s.loginText}>Anmelden</AppText>
            </Pressable>
          ) : null}
        </View>

        {activeTable ? (
          <View style={s.section}>
            <AppText accessibilityRole="header" style={s.sectionLabel}>
              Läuft gerade
            </AppText>
            <View style={s.activeCopy}>
              <AppText style={s.activeTitle} numberOfLines={2}>
                {activeTable.name}
              </AppText>
              <AppText style={s.small}>
                {count(activeRounds, 'Spiel', 'Spiele')} ·{' '}
                {count(players.length, 'Spieler', 'Spieler')}
              </AppText>
            </View>
            <GoldButton
              title="Weiterspielen"
              accessibilityLabel={`Weiterspielen an ${activeTable.name}`}
              onPress={() => openTarget({ kind: 'active' })}
            />
          </View>
        ) : (
          <View style={s.section}>
            <GoldButton title="Neuer Tisch" onPress={createTable} />
          </View>
        )}

        {unpaid.length ? (
          <View style={s.section}>
            <AppText accessibilityRole="header" style={s.sectionLabel}>
              Abrechnungen
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Offene Abrechnungen öffnen"
              onPress={() =>
                unpaid.length === 1
                  ? openTarget(unpaid[0][1].target)
                  : setSheet('payments')
              }
              style={({ pressed }) => [
                s.row,
                pressed && authInteraction.pressed,
              ]}
            >
              <ReceiptText size={26} color={c.textMutedGreen} />
              <View style={s.rowCopy}>
                <AppText style={s.rowTitle}>
                  {unpaid.length}{' '}
                  {unpaid.length === 1
                    ? 'Tisch noch offen'
                    : 'Tische noch offen'}
                </AppText>
                <AppText style={s.small}>Abgeschlossene Spielabende</AppText>
              </View>
              <ChevronRight size={22} color={c.textMutedGreen} />
            </Pressable>
          </View>
        ) : null}

        {recent.length ? (
          <View style={s.section}>
            <AppText accessibilityRole="header" style={s.sectionLabel}>
              Letzte Tische
            </AppText>
            {recent.map(({ table, open }) => (
              <Pressable
                key={table.id}
                accessibilityRole="button"
                accessibilityLabel={`${table.name} öffnen`}
                onPress={() => openTarget(table.target)}
                style={({ pressed }) => [
                  s.row,
                  pressed && authInteraction.pressed,
                ]}
              >
                <Spade size={22} color={c.textMutedGreen} />
                <View style={s.rowCopy}>
                  <AppText style={s.rowTitle} numberOfLines={1}>
                    {table.name}
                  </AppText>
                  <AppText style={s.small}>
                    {count(table.rounds.length, 'Spiel', 'Spiele')} ·{' '}
                    {table.target.kind === 'legacy'
                      ? 'frühere App-Version'
                      : open
                        ? `${count(open, 'Zahlung', 'Zahlungen')} offen`
                        : 'abgerechnet'}
                  </AppText>
                </View>
                <ChevronRight size={22} color={c.textMutedGreen} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Alle Tische ansehen"
          onPress={openTables}
          style={({ pressed }) => [
            s.allTables,
            pressed && authInteraction.pressed,
          ]}
        >
          <AppText style={s.secondary}>Alle Tische ansehen</AppText>
          <ChevronRight size={22} color={c.textSecondary} />
        </Pressable>
        {sheet === 'payments' ? (
          <DashboardSheet
            title="Offene Abrechnungen"
            onClose={() => setSheet(null)}
          >
            {unpaid.map(([id, p]) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`Abrechnung ${p.name} öffnen`}
                onPress={() => {
                  setSheet(null);
                  openTarget(p.target);
                }}
                style={({ pressed }) => [
                  s.pickerRow,
                  pressed && authInteraction.pressed,
                ]}
              >
                <View style={s.rowCopy}>
                  <AppText style={s.rowTitle}>{p.name}</AppText>
                  <AppText style={s.small}>
                    {p.count} offene {p.count === 1 ? 'Zahlung' : 'Zahlungen'}
                  </AppText>
                </View>
                <ChevronRight size={22} color={c.textMutedGreen} />
              </Pressable>
            ))}
          </DashboardSheet>
        ) : null}
      </ScrollView>
    </AuthBackground>
  );
}
const s = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: 120 },
  totals: {
    marginTop: space.xxl,
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  loginLink: {
    alignSelf: 'center',
    minHeight: authControlSizes.touch,
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  loginText: {
    ...authTextStyles.label,
    color: c.gold,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  section: {
    gap: space.sm,
    paddingVertical: space.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  sectionLabel: {
    ...authTextStyles.caption,
    color: c.textMutedGreen,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  activeCopy: { gap: space.xs, paddingBottom: space.sm },
  activeTitle: { ...authTextStyles.subtitle, color: c.textPrimary },
  secondary: { ...authTextStyles.body, color: c.textSecondary, flexShrink: 1 },
  small: { ...authTextStyles.caption, color: c.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: authControlSizes.touch + space.sm,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    ...authTextStyles.body,
    fontWeight: '600',
    color: c.textPrimary,
  },
  allTables: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: authControlSizes.touch,
    paddingVertical: space.md,
    marginTop: space.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: authControlSizes.touch,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
});
