import { useIsFocused } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { Check } from 'lucide-react-native';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';
import type { AppStackScreenProps } from '../../navigation/types';
import { readFriends } from '../../services/friends/friends';
import {
  exitSharedTable,
  publishSharedTable,
  refreshSharedTables,
  sharedSnapshot,
  syncSharedTable,
} from '../../services/shared/sharedTables';
import {
  executeInvitation,
  InvitationError,
  listTableInvitations,
  readInvitationOperation,
} from '../../services/shared/tableInvitations';
import { fingerprint } from '../../services/sync/syncGameState';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import type { ProfileCard } from '../../types/profile';
import type {
  InvitationCommand,
  InvitationState,
} from '../../types/tableInvitation';

export function TableInvitationsScreen({
  navigation,
  route,
}: AppStackScreenProps<'TableInvitations'>) {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useIsFocused();
  if (!actor)
    return (
      <AuthBackground>
        <View style={s.content}>
          <PageHeader title="Einladungen" onBack={() => navigation.goBack()} />
          <Notice tone="info">
            Einladungen gibt es nur mit einem Account.
          </Notice>
        </View>
      </AuthBackground>
    );
  return (
    <InvitationsContent
      key={actor}
      actor={actor}
      tableId={route.params?.tableId}
      active={focused}
      onBack={() => navigation.goBack()}
    />
  );
}
export function InvitationsContent({
  actor,
  tableId,
  active = true,
  onBack,
}: {
  actor: string;
  tableId?: string;
  active?: boolean;
  onBack: () => void;
}) {
  const currentActor = useAuthStore((s) => s.user?.id);
  const archived = useGameStore((s) =>
    s.archivedGameDays.find((day) => day.table.id === tableId),
  );
  const currentTable = useGameStore((s) => s.currentTable);
  const currentPlayers = useGameStore((s) => s.players);
  const table = archived?.table ?? currentTable;
  const players = archived?.players ?? currentPlayers;
  const [state, setState] = useState<InvitationState | null>(null);
  const [friends, setFriends] = useState<ProfileCard[]>([]);
  const [pending, setPending] = useState<InvitationCommand | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [notice, setNotice] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [friendId, setFriendId] = useState('');
  const [role, setRole] = useState<'read' | 'write'>('read');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const gate = useRef(false);
  const alive = useRef(true);
  const validActor = useCallback(
    () => alive.current && useAuthStore.getState().user?.id === actor,
    [actor],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    if (gate.current || !validActor()) return;
    gate.current = true;
    const results = await Promise.allSettled([
      listTableInvitations(actor),
      readInvitationOperation(actor),
      tableId ? readFriends(actor) : Promise.resolve(null),
    ]);
    if (validActor()) {
      const [list, operation, contacts] = results;
      if (list.status === 'fulfilled') setState(list.value);
      if (operation.status === 'fulfilled') setPending(operation.value);
      if (contacts.status === 'fulfilled' && contacts.value)
        setFriends(contacts.value.friends.map((f) => f.profile));
      setStorageError(operation.status === 'rejected');
      setError(
        results.some((r) => r.status === 'rejected')
          ? 'Einladungen konnten nicht vollständig geladen werden. Bitte erneut laden.'
          : '',
      );
      setLoading(false);
    }
    gate.current = false;
  }, [actor, tableId, validActor]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    const subscription = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [active, load]);
  async function run(command: InvitationCommand) {
    if (gate.current || !validActor()) return;
    gate.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await executeInvitation(actor, command);
      if (validActor()) {
        setState(next);
        setPending(null);
        setStorageError(false);
        setNotice(
          command.action === 'accept'
            ? 'Einladung angenommen. Der gemeinsame Tisch steht jetzt unter „Tische“.'
            : command.action === 'cancel'
              ? 'Einladung zurückgezogen.'
              : command.action === 'send'
                ? 'Einladung verschickt.'
                : 'Erledigt.',
        );
        if (command.action === 'send') {
          setStep(1);
          setPlayerId('');
          setFriendId('');
        }
      }
      // Membership is confirmed before discovery; opening remains an explicit action.
      if (useAuthStore.getState().user?.id === actor)
        await refreshSharedTables();
    } catch (e) {
      if (validActor()) {
        if (e instanceof InvitationError && e.state) setState(e.state);
        setError(e instanceof Error ? e.message : 'Änderung fehlgeschlagen.');
        try {
          const saved = await readInvitationOperation(actor);
          if (validActor()) {
            setPending(saved);
            setStorageError(false);
          }
        } catch {
          if (validActor()) setStorageError(true);
        }
      }
    } finally {
      if (validActor()) setBusy(false);
      gate.current = false;
    }
  }
  async function send() {
    if (gate.current || !validActor()) return;
    gate.current = true;
    setBusy(true);
    setError('');
    let command: InvitationCommand | undefined;
    try {
      await syncSharedTable();
      const local = useGameStore.getState().currentTable;
      if (
        validActor() &&
        tableId &&
        local?.id === tableId &&
        !local.shared &&
        local.isActive
      )
        await publishSharedTable({ actor, tableId });
      const latest = useGameStore.getState().currentTable;
      if (
        !validActor() ||
        !latest?.shared ||
        latest.id !== tableId ||
        latest.shared.userId !== actor ||
        latest.shared.ownerId !== actor ||
        fingerprint(sharedSnapshot()) !== latest.shared.baseline
      )
        throw new Error(
          'Bitte zuerst den aktuellen Tischstand synchronisieren.',
        );
      command = {
        action: 'send',
        id: Crypto.randomUUID(),
        tableId: latest.id,
        recipientId: friendId,
        playerId,
        role,
        version: latest.shared.version,
      };
    } catch (e) {
      if (validActor())
        setError(e instanceof Error ? e.message : 'Tisch nicht bereit.');
    } finally {
      gate.current = false;
      if (validActor()) setBusy(false);
    }
    if (command) await run(command);
  }
  if (currentActor !== actor)
    return (
      <AuthBackground>
        <View style={s.content}>
          <Notice tone="info">
            Das Konto hat sich geändert. Bitte die Seite erneut öffnen.
          </Notice>
        </View>
      </AuthBackground>
    );
  const disabled = loading || busy || !!pending || storageError || !state;
  const canInvite =
    tableId &&
    table?.id === tableId &&
    (!table.shared ||
      (table.shared.userId === actor && table.shared.ownerId === actor)) &&
    table.isActive;
  const entries =
    state?.invitations.filter((i) => !tableId || i.tableId === tableId) ?? [];
  const canManage =
    table?.id === tableId &&
    table?.shared?.ownerId === actor &&
    table.shared.userId === actor;
  const members = canManage ? table.shared?.members : undefined;
  const revokedSeat = (account: string) =>
    !!members && !members.some((member) => member.userId === account);
  const eligibleSeats = players.filter(
    (p) => !p.userId || revokedSeat(p.userId),
  );
  const selectedSeat = eligibleSeats.find((p) => p.id === playerId);
  const eligibleFriends = friends.filter((f) =>
    selectedSeat?.userId
      ? f.id === selectedSeat.userId
      : !players.some((p) => p.userId === f.id),
  );

  async function revoke(userId: string) {
    if (!tableId || gate.current || !validActor()) return;
    gate.current = true;
    setBusy(true);
    setError('');
    try {
      await exitSharedTable(tableId, userId);
      await syncSharedTable();
      if (validActor()) {
        setRevoking(null);
        setNotice(
          'Tischzugriff entzogen. Die Abrechnung bleibt unter „Frühere Abrechnungen“ zugänglich.',
        );
      }
    } catch {
      if (validActor()) setError('Tischzugriff konnte nicht entzogen werden.');
    } finally {
      gate.current = false;
      if (validActor()) setBusy(false);
    }
  }

  const received = entries.filter((i) => i.recipient.id === actor);
  const sent = entries.filter((i) => i.recipient.id !== actor);
  const shown = tableId ? entries : tab === 'received' ? received : sent;
  const roleLabel = (r: 'read' | 'write') =>
    r === 'write' ? 'Spiele eintragen' : 'Nur ansehen';

  return (
    <AuthBackground>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.content}
        data={shown}
        keyExtractor={(i) => i.id}
        refreshing={loading && !!state}
        onRefresh={() => {
          setLoading(true);
          void load();
        }}
        ListHeaderComponent={
          <View style={s.stack}>
            <PageHeader
              title="Einladungen"
              subtitle={tableId && table ? table.name : undefined}
              onBack={onBack}
            />
            <AppText style={s.hint}>
              Erst wenn eine Einladung angenommen wird, wird das Konto mit dem
              Spielerplatz verbunden.
            </AppText>
            {!!error && <Notice>{error}</Notice>}
            {!!error && (
              <AppButton
                title="Erneut laden"
                variant="secondary"
                disabled={loading || busy}
                onPress={() => {
                  setLoading(true);
                  void load();
                }}
              />
            )}
            {!!notice && <Notice tone="success">{notice}</Notice>}
            {pending && (
              <View style={s.card}>
                <AppText>
                  Eine Änderung ist noch nicht abschließend bestätigt. Prüfe sie
                  erneut; weitere Änderungen sind bis dahin gesperrt.
                </AppText>
                <AppButton
                  title="Erneut prüfen"
                  disabled={busy || loading || storageError}
                  onPress={() => void run(pending)}
                />
              </View>
            )}
            {members?.some((member) => member.userId !== actor) ? (
              <View style={s.card}>
                <AppText style={s.cardTitle}>Wer hat Zugriff?</AppText>
                {members
                  .filter((member) => member.userId !== actor)
                  .map((member) => {
                    const name =
                      players.find((p) => p.userId === member.userId)?.name ??
                      'Teilnehmer';
                    return (
                      <View key={member.userId} style={s.stack}>
                        <View style={s.memberRow}>
                          <View style={s.flex}>
                            <AppText style={s.strong}>{name}</AppText>
                            <AppText style={s.hint}>
                              {roleLabel(member.role)}
                            </AppText>
                          </View>
                          {revoking !== member.userId ? (
                            <AppButton
                              title="Entziehen"
                              accessibilityLabel={`Zugriff entziehen: ${name}`}
                              variant="danger"
                              disabled={busy}
                              onPress={() => setRevoking(member.userId)}
                            />
                          ) : null}
                        </View>
                        {revoking === member.userId ? (
                          <>
                            <AppText style={s.hint}>
                              Spielerplatz und Abrechnung bleiben erhalten. Nur
                              der Zugriff auf den Tisch endet.
                            </AppText>
                            <View style={s.buttonRow}>
                              <AppButton
                                title="Zugriff entziehen"
                                variant="danger"
                                disabled={busy}
                                onPress={() => void revoke(member.userId)}
                                style={s.flex}
                              />
                              <AppButton
                                title="Abbrechen"
                                variant="secondary"
                                disabled={busy}
                                onPress={() => setRevoking(null)}
                                style={s.flex}
                              />
                            </View>
                          </>
                        ) : null}
                      </View>
                    );
                  })}
              </View>
            ) : null}
            {canInvite ? (
              <View style={[s.card, s.inviteCard]}>
                <AppText style={s.cardTitle}>Freund einladen</AppText>
                <AppText style={s.hint}>
                  Schritt {step} von 3 ·{' '}
                  {step === 1
                    ? 'Spielerplatz'
                    : step === 2
                      ? 'Freund'
                      : 'Berechtigung'}
                </AppText>
                {step === 1 ? (
                  <>
                    <AppText style={s.hint}>
                      Name, bisherige Spiele und Saldo des Platzes bleiben
                      erhalten.
                    </AppText>
                    {eligibleSeats.map((p) => (
                      <Choice
                        key={p.id}
                        label={`Platz: ${p.name}`}
                        title={p.name}
                        selected={playerId === p.id}
                        disabled={disabled}
                        onPress={() => {
                          setPlayerId(p.id);
                          setFriendId('');
                        }}
                      />
                    ))}
                    {!eligibleSeats.length && (
                      <AppText style={s.hint}>
                        Alle Spielerplätze sind bereits mit einem Konto
                        verbunden.
                      </AppText>
                    )}
                    <AppButton
                      title="Weiter"
                      disabled={disabled || !selectedSeat}
                      onPress={() => setStep(2)}
                    />
                  </>
                ) : null}
                {step === 2 ? (
                  <>
                    {eligibleFriends.map((f) => (
                      <Choice
                        key={f.id}
                        label={f.displayName}
                        title={f.displayName}
                        avatar={<ProfileAvatar profile={f} size={32} />}
                        selected={friendId === f.id}
                        disabled={disabled}
                        onPress={() => setFriendId(f.id)}
                      />
                    ))}
                    {!friends.length && !loading && (
                      <AppText style={s.hint}>
                        Noch keine Freunde. Füge zuerst unter Profil → Freunde
                        einen Kontakt hinzu.
                      </AppText>
                    )}
                    <View style={s.buttonRow}>
                      <AppButton
                        title="Zurück"
                        variant="secondary"
                        onPress={() => setStep(1)}
                        style={s.flex}
                      />
                      <AppButton
                        title="Weiter"
                        disabled={
                          disabled ||
                          !eligibleFriends.some((f) => f.id === friendId)
                        }
                        onPress={() => setStep(3)}
                        style={s.flex}
                      />
                    </View>
                  </>
                ) : null}
                {step === 3 ? (
                  <>
                    <View style={s.segment}>
                      {(['read', 'write'] as const).map((r) => (
                        <Pressable
                          key={r}
                          accessibilityRole="button"
                          accessibilityLabel={
                            r === 'write' ? 'Schreiben' : 'Lesen'
                          }
                          accessibilityState={{
                            selected: r === role,
                            disabled,
                          }}
                          disabled={disabled}
                          onPress={() => setRole(r)}
                          style={[s.segmentItem, r === role && s.segmentOn]}
                        >
                          <AppText
                            style={[
                              s.segmentText,
                              r === role && s.segmentTextOn,
                            ]}
                          >
                            {roleLabel(r)}
                          </AppText>
                        </Pressable>
                      ))}
                    </View>
                    <AppText style={s.hint}>
                      {role === 'write'
                        ? 'Darf Spiele eintragen, korrigieren und löschen. Die Verwaltung des Tisches bleibt bei dir.'
                        : 'Sieht Tisch, Spiele und Salden, kann aber nichts ändern.'}
                    </AppText>
                    <View style={s.buttonRow}>
                      <AppButton
                        title="Zurück"
                        variant="secondary"
                        onPress={() => setStep(2)}
                        style={s.flex}
                      />
                      <AppButton
                        title="Einladung senden"
                        disabled={
                          disabled ||
                          !selectedSeat ||
                          !eligibleFriends.some((f) => f.id === friendId)
                        }
                        onPress={() => void send()}
                        style={s.flex}
                      />
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
            {tableId ? (
              <AppText style={s.cardTitle}>
                Offene Einladungen für diesen Tisch
              </AppText>
            ) : (
              <View style={s.segment}>
                {(['received', 'sent'] as const).map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === t }}
                    onPress={() => setTab(t)}
                    style={[s.segmentItem, tab === t && s.segmentOn]}
                  >
                    <AppText
                      style={[s.segmentText, tab === t && s.segmentTextOn]}
                    >
                      {t === 'received'
                        ? `Erhalten ${received.length}`
                        : `Verschickt ${sent.length}`}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <AppText style={s.hint}>
            {!state
              ? loading
                ? 'Einladungen werden geladen …'
                : 'Die Einladungen konnten noch nicht geladen werden.'
              : 'Keine offenen Einladungen.'}
          </AppText>
        }
        renderItem={({ item: i }) => {
          const incoming = i.recipient.id === actor;
          return (
            <View style={[s.card, incoming && i.available && s.inviteCard]}>
              <View style={s.memberRow}>
                <ProfileAvatar
                  profile={incoming ? i.sender : i.recipient}
                  size={40}
                />
                <View style={s.flex}>
                  <AppText style={s.strong}>
                    {incoming
                      ? `${i.sender.displayName} lädt dich ein`
                      : `An ${i.recipient.displayName}`}
                  </AppText>
                  <AppText style={s.hint}>{i.tableName}</AppText>
                </View>
              </View>
              <AppText>
                {incoming ? 'Dein Platz' : 'Platz'}:{' '}
                <AppText style={s.strong}>{i.playerName}</AppText> · Rolle:{' '}
                <AppText style={s.strong}>{roleLabel(i.role)}</AppText>
              </AppText>
              <AppText style={s.hint}>
                {i.available
                  ? `Gültig bis ${new Date(i.expiresAt).toLocaleDateString('de-DE')}`
                  : 'Nicht mehr verfügbar. Du kannst sie schließen.'}
              </AppText>
              {incoming ? (
                <View style={s.buttonRow}>
                  <AppButton
                    title="Annehmen"
                    accessibilityLabel="Einladung annehmen"
                    disabled={disabled || !i.available}
                    onPress={() => void run({ action: 'accept', id: i.id })}
                    style={s.flex}
                  />
                  <AppButton
                    title={i.available ? 'Ablehnen' : 'Schließen'}
                    accessibilityLabel="Einladung ablehnen"
                    variant="danger"
                    disabled={disabled}
                    onPress={() => void run({ action: 'decline', id: i.id })}
                    style={s.flex}
                  />
                </View>
              ) : (
                <AppButton
                  title="Zurückziehen"
                  accessibilityLabel="Einladung zurückziehen"
                  variant="secondary"
                  disabled={disabled}
                  onPress={() => void run({ action: 'cancel', id: i.id })}
                />
              )}
            </View>
          );
        }}
      />
    </AuthBackground>
  );
}
function Choice({
  label,
  title,
  avatar,
  onPress,
  disabled = false,
  selected = false,
}: {
  label: string;
  title: string;
  avatar?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[s.choice, selected && s.choiceOn, disabled && s.disabled]}
    >
      {avatar}
      <AppText style={s.strong}>{title}</AppText>
      {selected ? (
        <Check color={authColors.goldHighlight} size={18} style={s.check} />
      ) : null}
    </Pressable>
  );
}
const s = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12, paddingBottom: 40 },
  stack: { gap: 12 },
  hint: { color: authColors.textSecondary, fontSize: 13, lineHeight: 19 },
  strong: { color: authColors.textPrimary, fontWeight: '700' },
  cardTitle: { color: authColors.textPrimary, fontSize: 17, fontWeight: '700' },
  card: {
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    borderRadius: 22,
    backgroundColor: authColors.surfaceElevated,
  },
  inviteCard: { borderColor: authColors.borderGold },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    backgroundColor: authColors.surfaceElevated,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  segmentOn: { backgroundColor: authColors.gold },
  segmentText: { color: authColors.textSecondary, fontWeight: '700' },
  segmentTextOn: { color: authColors.onGold },
  choice: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
  },
  choiceOn: {
    borderColor: authColors.gold,
    backgroundColor: authColors.selectedSurface,
  },
  check: { marginLeft: 'auto' },
  disabled: { opacity: 0.45 },
  flex: { flex: 1 },
});
