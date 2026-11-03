import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { reliableStorage } from '../../storage/reliableStorage';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors, authSpacing } from '../../theme';
import type {
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../../types/game';
import { toSafeCents } from '../../utils/accounting';
import {
  outstandingBalances,
  paymentRevision,
} from '../../utils/interimPayments';
import { tableAccess } from '../../utils/tableAccess';
import { GoldButton } from '../auth/GoldButton';
import { AppText } from '../ui/AppText';

const money = (amount: number) => `${amount.toFixed(2).replace('.', ',')} €`;
type Props = {
  table: GameTable;
  players: Player[];
  balances: PlayerBalance[];
  plan: Settlement[];
  stockCents: number;
};
export function InterimPaymentsPanel({
  table,
  players,
  balances,
  plan,
  stockCents,
}: Props) {
  const actorId = useAuthStore((state) => state.user?.id);
  const { canManage } = tableAccess(table, actorId);
  const [selected, setSelected] = useState<{
    payment: Settlement;
    revision: string;
  } | null>(null);
  const [amount, setAmount] = useState('');
  const [confirmAll, setConfirmAll] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);
  const locked = useRef(false);
  const name = (id: string) =>
    players.find((p) => p.id === id)?.name ?? 'Unbekannt';
  const revision = paymentRevision(table, balances);
  // A funded stock prevents a complete zero-sum plan. Individual transfers
  // are still offered between players who currently owe and receive money.
  const due = useGameStore.getState();
  const suggestions = stockCents > 0 ? [] : plan;
  const activePayments = (table.interimPayments ?? []).filter(
    (p) => !p.voidedAt,
  );
  async function commit(action?: () => boolean) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action && !action())
        throw new Error(
          'Der Spielstand hat sich geändert oder der Betrag ist ungültig. Bitte die Zahlung erneut auswählen.',
        );
      setNeedsRetry(true);
      setSelected(null);
      setConfirmAll(null);
      await reliableStorage.retryWrites();
      if (!(await reliableStorage.confirmWrite('schafkopfrechner-games')))
        throw new Error(
          'Die Zahlung ist eingetragen, aber noch nicht auf dem Gerät gesichert. Bitte erneut sichern; sie wird nicht doppelt eingetragen.',
        );
      setNeedsRetry(false);
      setNotice('Auf dem Gerät gespeichert. Der Tisch bleibt geöffnet.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const candidates =
    stockCents > 0 ? makeSuggestions(balances, table) : suggestions;
  const cents = toSafeCents(Number(amount.replace(',', '.')));
  const valid =
    selected &&
    cents !== null &&
    cents > 0 &&
    cents <= toSafeCents(selected.payment.amount)!;
  if (!canManage)
    return (
      <View style={s.stack}>
        <AppText style={s.note}>Zahlungen verwaltet der Ersteller.</AppText>
        {candidates.map((payment) => (
          <AppText key={payment.id}>
            {name(payment.fromPlayerId)} → {name(payment.toPlayerId)}:{' '}
            {money(payment.amount)}
          </AppText>
        ))}
      </View>
    );
  return (
    <View style={s.stack}>
      <AppText style={s.note}>
        Erfasse hier nur bereits bezahlte Beträge. Tisch, Spielverlauf, Regeln
        und Geber bleiben erhalten.
      </AppText>
      {stockCents > 0 ? (
        <AppText style={s.note}>
          Der Stock bleibt bestehen. Ein vollständiger Ausgleich ist bei leerem
          Stock möglich.
        </AppText>
      ) : null}
      {!candidates.length ? (
        <AppText style={s.heading}>
          Aktuell keine Zahlungen zwischen Spielern nötig.
        </AppText>
      ) : (
        candidates.map((payment) => (
          <Pressable
            key={payment.id}
            accessibilityRole="button"
            accessibilityLabel={`${name(payment.fromPlayerId)} an ${name(payment.toPlayerId)}: Zwischenzahlung erfassen`}
            disabled={busy || needsRetry}
            onPress={() => {
              setSelected({ payment, revision });
              setAmount(String(payment.amount).replace('.', ','));
              setConfirmAll(null);
              setError('');
            }}
            style={s.row}
          >
            <AppText style={s.text}>
              {name(payment.fromPlayerId)} → {name(payment.toPlayerId)}
            </AppText>
            <AppText style={s.heading}>{money(payment.amount)}</AppText>
            <AppText style={s.note}>Betrag erfassen</AppText>
          </Pressable>
        ))
      )}
      {selected ? (
        <View style={s.stack}>
          <AppText style={s.heading}>
            {name(selected.payment.fromPlayerId)} zahlt an{' '}
            {name(selected.payment.toPlayerId)}
          </AppText>
          <AppText style={s.note}>
            Bereits bezahlt · höchstens {money(selected.payment.amount)}
          </AppText>
          <TextInput
            accessibilityLabel="Bereits bezahlter Betrag"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            editable={!busy}
            style={s.input}
          />
          <GoldButton
            title="Zwischenzahlung speichern"
            disabled={!valid || busy || needsRetry}
            onPress={() => {
              const payment = {
                id: Crypto.randomUUID(),
                fromPlayerId: selected.payment.fromPlayerId,
                toPlayerId: selected.payment.toPlayerId,
                amount: cents! / 100,
              };
              void commit(() =>
                due.recordInterimPayment(table.id, selected.revision, payment),
              );
            }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelected(null)}
            disabled={busy}
            style={s.row}
          >
            <AppText style={s.text}>Abbrechen</AppText>
          </Pressable>
        </View>
      ) : null}
      {plan.length > 0 && stockCents === 0 && !needsRetry ? (
        <GoldButton
          title="Alles ausgleichen"
          disabled={busy}
          onPress={() => {
            setConfirmAll(revision);
            setSelected(null);
          }}
        />
      ) : null}
      {confirmAll ? (
        <View style={s.stack}>
          <AppText style={s.heading}>
            Sind alle oben aufgeführten Zahlungen bereits erfolgt?
          </AppText>
          <AppText style={s.note}>
            Die offenen Beträge werden auf null gesetzt. Ihr könnt anschließend
            am selben Tisch weiterspielen.
          </AppText>
          <GoldButton
            title="Alle Zahlungen als bezahlt erfassen"
            disabled={busy || needsRetry}
            onPress={() =>
              void commit(() => due.settleInterimPayments(table.id, confirmAll))
            }
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmAll(null)}
            disabled={busy}
            style={s.row}
          >
            <AppText style={s.text}>Abbrechen</AppText>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <AppText accessibilityRole="alert" style={s.note}>
          {error}
        </AppText>
      ) : null}
      {needsRetry ? (
        <GoldButton
          title="Erneut auf Gerät sichern"
          disabled={busy}
          onPress={() => void commit()}
        />
      ) : null}
      {notice ? (
        <AppText accessibilityRole="alert" style={s.note}>
          {notice}
        </AppText>
      ) : null}
      {activePayments.length ? (
        <AppText style={s.heading}>Erfasste Zwischenzahlungen</AppText>
      ) : null}
      {activePayments.map((payment) => (
        <View key={payment.id} style={s.row}>
          <AppText style={s.text}>
            {name(payment.fromPlayerId)} → {name(payment.toPlayerId)} ·{' '}
            {money(payment.amount)}
          </AppText>
          <AppText style={s.note}>
            {new Date(payment.createdAt).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · Bezahlt
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Zwischenzahlung von ${name(payment.fromPlayerId)} an ${name(payment.toPlayerId)}, ${money(payment.amount)} rückgängig machen`}
            disabled={busy || needsRetry}
            onPress={() =>
              void commit(() => due.voidInterimPayment(table.id, payment.id))
            }
            style={s.action}
          >
            <AppText style={s.text}>Rückgängig</AppText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
function makeSuggestions(
  balances: PlayerBalance[],
  table: GameTable,
): Settlement[] {
  const due = outstandingBalances(balances, table.interimPayments);
  return due
    .filter((p) => p.amount < 0)
    .flatMap((from) =>
      due
        .filter((p) => p.amount > 0)
        .map((to) => ({
          id: `${from.playerId}-${to.playerId}`,
          fromPlayerId: from.playerId,
          toPlayerId: to.playerId,
          amount: Math.min(-from.amount, to.amount),
          isPaid: false,
        })),
    );
}
const s = StyleSheet.create({
  stack: { gap: authSpacing.md },
  heading: { color: authColors.goldHighlight, fontWeight: '700', fontSize: 18 },
  note: { color: authColors.textSecondary, lineHeight: 22 },
  text: { color: authColors.textPrimary, flexShrink: 1 },
  row: {
    gap: authSpacing.sm,
    paddingVertical: authSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.borderGold,
    minHeight: 48,
  },
  input: {
    backgroundColor: authColors.background,
    color: authColors.textPrimary,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    borderRadius: 12,
    padding: authSpacing.md,
    fontSize: 20,
    minHeight: 48,
  },
  action: { minHeight: 44, justifyContent: 'center' },
});
