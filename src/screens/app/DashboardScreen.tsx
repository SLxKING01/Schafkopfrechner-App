import { ChevronRight, ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { DashboardSheet } from '../../components/dashboard/DashboardSheet';
import { DashboardTotals } from '../../components/dashboard/DashboardTotals';
import { SchafkopfBackdrop } from '../../components/dashboard/SchafkopfBackdrop';
import { AppText } from '../../components/ui/AppText';
import { useGameOverview } from '../../hooks/useGameOverview';
import { useOverviewNavigation } from '../../hooks/useOverviewNavigation';
import { useOwnProfile } from '../../hooks/useOwnProfile';
import { useAuthStore } from '../../store/authStore';
import {
  authColors as c,
  authControlSizes,
  authInteraction,
  authSpacing as space,
  authTextStyles,
} from '../../theme';
import { dashboardPersonal } from '../../utils/dashboardPersonal';

export function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const overview = useGameOverview();
  const { openTarget, openProfile, openStatistics, openTables } =
    useOverviewNavigation();
  const [sheet, setSheet] = useState<'payments' | null>(null);
  const tables = overview.statisticsTables;
  const personal = useMemo(
    () => dashboardPersonal(tables, user?.id),
    [tables, user?.id],
  );
  const { displayName: username } = useOwnProfile();
  const known = !!user?.id || !tables.length;
  const payments = overview.payments;
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
            known={known}
            caption={
              user?.id
                ? personal.summary.count
                  ? 'Über deine verknüpften Spielerkonten'
                  : 'Deine Bilanz beginnt mit dem ersten Spiel'
                : 'Melde dich an, um deine Bilanz zu sehen.'
            }
            onPress={openStatistics}
          />
        </View>
        {unpaid.length ? (
          <View style={s.section}>
            <AppText accessibilityRole="header" style={s.sectionLabel}>
              ABRECHNUNGEN
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
                s.paymentRow,
                pressed && authInteraction.pressed,
              ]}
            >
              <ReceiptText size={28} color={c.textMutedGreen} />
              <View style={s.rowCopy}>
                <AppText style={s.paymentTitle}>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Alle Tische ansehen"
          onPress={openTables}
          style={({ pressed }) => [
            s.newTable,
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
                  <AppText style={s.paymentTitle}>{p.name}</AppText>
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
    marginTop: space.xxxl,
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  section: {
    paddingTop: space.xl,
    paddingBottom: space.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  sectionLabel: {
    ...authTextStyles.subhead,
    color: c.textMutedGreen,
    fontWeight: '400',
  },
  secondary: { ...authTextStyles.body, color: c.textSecondary, flexShrink: 1 },
  small: { ...authTextStyles.caption, color: c.textSecondary },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: authControlSizes.touch,
    paddingTop: space.lg,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: space.xs },
  paymentTitle: {
    ...authTextStyles.label,
    fontWeight: '600',
    color: c.textPrimary,
  },
  newTable: {
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
