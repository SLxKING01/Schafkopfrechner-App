import {
  ArrowRight,
  Check,
  ChevronRight,
  ReceiptText,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { DashboardSheet } from '../../components/dashboard/DashboardSheet';
import { DashboardTotals } from '../../components/dashboard/DashboardTotals';
import { SyncStatus } from '../../components/game/SyncStatus';
import { AppText } from '../../components/ui/AppText';
import { useGameOverview } from '../../hooks/useGameOverview';
import { useOverviewNavigation } from '../../hooks/useOverviewNavigation';
import { useAuthStore } from '../../store/authStore';
import { useDashboardIdentityStore } from '../../store/dashboardIdentityStore';
import {
  authColors as c,
  authControlSizes,
  authInteraction,
  authRadius,
  authSpacing as space,
  authTextStyles,
} from '../../theme';
import { dashboardPersonal } from '../../utils/dashboardPersonal';
import { formatOverviewMoney } from '../../utils/gameOverview';

const emptySelections: Record<string, string> = {};
export function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const selections = useDashboardIdentityStore((s) => s.selections);
  const ready = useDashboardIdentityStore((s) => s.hydrated);
  const select = useDashboardIdentityStore((s) => s.select);
  const overview = useGameOverview();
  const { openTarget, openProfile, openStatistics, openTables, createTable } =
    useOverviewNavigation();
  const [sheet, setSheet] = useState<'identity' | 'payments' | null>(null);
  const scope = user?.id ? `account:${user.id}` : 'guest';
  const selected = selections[scope] ?? emptySelections;
  const tables = overview.statisticsTables;
  const personal = useMemo(
    () => dashboardPersonal(tables, selected, user?.id),
    [tables, selected, user?.id],
  );
  const active = tables.find((t) => t.target.kind === 'active');
  const activePlayer = active?.players.find(
    (p) => p.id === personal.memberships.get(active.id),
  );
  const displayPlayer =
    activePlayer ??
    tables.flatMap((t) =>
      t.players.filter((p) => p.id === personal.memberships.get(t.id)),
    )[0];
  const username =
    typeof user?.user_metadata?.username === 'string' &&
    user.user_metadata.username.trim()
      ? user.user_metadata.username.trim()
      : (user?.email?.split('@')[0] ?? displayPlayer?.name ?? 'Gast');
  const known = ready && (personal.hasIdentity || !tables.length);
  const tableBalance =
    active && activePlayer
      ? active.rounds.reduce(
          (sum, r) => sum + (r.deltas[activePlayer.id] ?? 0),
          0,
        )
      : null;
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
    <AuthBackground>
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
            onManage={
              ready && tables.length ? () => setSheet('identity') : undefined
            }
            caption={
              !ready
                ? 'Persönliche Werte werden geladen …'
                : personal.hasIdentity
                  ? personal.unassigned
                    ? 'Über deine zugeordneten Tische'
                    : 'Über alle deine Tische'
                  : !tables.length
                    ? 'Deine Bilanz beginnt mit dem ersten Spiel'
                    : 'Wähle deinen Spieler für persönliche Werte'
            }
            onPress={() => {
              if (ready) {
                if (personal.hasIdentity || !tables.length) openStatistics();
                else setSheet('identity');
              }
            }}
          />
          {ready && personal.unassigned > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fehlende Spieler zuordnen"
              onPress={() => setSheet('identity')}
              style={({ pressed }) => [
                s.identityAction,
                pressed && authInteraction.pressed,
              ]}
            >
              <AppText style={s.identityText}>
                {personal.hasIdentity
                  ? `${personal.unassigned} ${personal.unassigned === 1 ? 'Tisch ergänzen' : 'Tische ergänzen'}`
                  : 'Spieler auswählen'}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <View style={s.section}>
          <AppText accessibilityRole="header" style={s.sectionLabel}>
            {overview.activeTable
              ? 'Laufender Tisch'
              : 'Dein nächster Spielabend'}
          </AppText>
          <AppText style={s.tableTitle}>
            {overview.activeTable?.name ?? 'Bereit für eine Runde?'}
          </AppText>
          <AppText style={s.secondary}>
            {active
              ? `${active.players.length} Spieler · ${active.rounds.length} ${active.rounds.length === 1 ? 'Runde' : 'Runden'}`
              : 'Erstelle einen Tisch und lade deine Mitspieler ein.'}
          </AppText>
          {ready && tableBalance !== null ? (
            <View style={s.balanceRow}>
              <AppText style={s.secondary}>Dein Stand</AppText>
              <AppText
                selectable
                accessibilityLabel={`Dein Stand am Tisch, ohne Stock: ${formatOverviewMoney(tableBalance)}`}
                style={[
                  s.tableBalance,
                  {
                    color:
                      tableBalance > 0
                        ? c.accentGreen
                        : tableBalance < 0
                          ? c.error
                          : c.textPrimary,
                  },
                ]}
              >
                {tableBalance > 0 ? '+' : ''}
                {formatOverviewMoney(tableBalance)}
              </AppText>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              overview.activeTarget ? 'Weiterspielen' : 'Tisch erstellen'
            }
            onPress={() =>
              overview.activeTarget
                ? openTarget(overview.activeTarget)
                : createTable()
            }
            style={({ pressed }) => [
              s.primary,
              pressed && authInteraction.pressed,
            ]}
          >
            <AppText style={s.primaryText}>
              {overview.activeTarget ? 'Weiterspielen' : 'Tisch erstellen'}
            </AppText>
            <ArrowRight size={22} color={c.onGold} />
          </Pressable>
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
        <SyncStatus />
        {sheet === 'identity' ? (
          <DashboardSheet
            title="Deine Spielerzuordnung"
            onClose={() => setSheet(null)}
          >
            <AppText style={s.secondary}>
              Wähle pro Tisch deinen Spieler. Nur diese Ergebnisse zählen zu
              deiner Gesamtbilanz. Gleiche Namen werden nicht automatisch
              zusammengeführt.
            </AppText>
            {tables.map((t) => {
              const linked = user?.id
                ? t.players.filter((p) => p.userId === user.id)
                : [];
              const fixed = linked.length === 1;
              return (
                <View key={t.id} style={s.pickerGroup}>
                  <AppText style={s.paymentTitle}>{t.name}</AppText>
                  <AppText style={s.small}>
                    {t.target.kind === 'active'
                      ? 'Aktiver Tisch'
                      : 'Archiv / Spieltag'}{' '}
                    · {t.rounds.length} Runden
                  </AppText>
                  {fixed ? (
                    <AppText style={s.small}>
                      Über dein Konto zugeordnet
                    </AppText>
                  ) : (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={`Keine Zuordnung für ${t.name}`}
                      accessibilityState={{
                        checked: !personal.memberships.has(t.id),
                      }}
                      onPress={() => select(scope, t.id, null)}
                      style={s.pickerRow}
                    >
                      <AppText style={s.secondary}>Nicht zugeordnet</AppText>
                      {!personal.memberships.has(t.id) ? (
                        <Check color={c.gold} size={20} />
                      ) : null}
                    </Pressable>
                  )}
                  {t.players.map((p) => {
                    const checked = personal.memberships.get(t.id) === p.id;
                    const disabled =
                      fixed || !!(p.userId && p.userId !== user?.id);
                    return (
                      <Pressable
                        key={p.id}
                        accessibilityRole="radio"
                        accessibilityLabel={`${p.name} für ${t.name} zuordnen`}
                        accessibilityState={{ checked, disabled }}
                        disabled={disabled}
                        onPress={() => select(scope, t.id, p.id)}
                        style={({ pressed }) => [
                          s.pickerRow,
                          pressed && authInteraction.pressed,
                        ]}
                      >
                        <AppText style={checked ? s.chosen : s.secondary}>
                          {p.name}
                        </AppText>
                        {checked ? <Check color={c.gold} size={20} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </DashboardSheet>
        ) : null}
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
  identityAction: {
    minHeight: authControlSizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { ...authTextStyles.caption, color: c.textMutedGreen },
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
  tableTitle: {
    ...authTextStyles.subtitle,
    color: c.textPrimary,
    fontWeight: '600',
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  secondary: { ...authTextStyles.body, color: c.textSecondary, flexShrink: 1 },
  small: { ...authTextStyles.caption, color: c.textSecondary },
  balanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xl,
  },
  tableBalance: { ...authTextStyles.subtitle },
  primary: {
    maxWidth: '100%',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    minHeight: authControlSizes.field,
    paddingVertical: space.md,
    paddingHorizontal: space.lgPlus,
    borderRadius: authRadius.sm,
    backgroundColor: c.goldHighlight,
    marginTop: space.lg,
  },
  primaryText: {
    ...authTextStyles.button,
    fontWeight: '600',
    color: c.onGold,
    flexShrink: 1,
  },
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
  pickerGroup: { gap: space.xs, marginBottom: space.md },
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
  chosen: { ...authTextStyles.body, color: c.gold },
});
