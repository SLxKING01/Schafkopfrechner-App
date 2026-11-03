import { useIsFocused } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { AppText } from '../../components/ui/AppText';
import type { AppStackScreenProps } from '../../navigation/types';
import { readFriends } from '../../services/friends/friends';
import {
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
          <AppText>Bitte zuerst anmelden.</AppText>
          <Action title="Zurück" onPress={() => navigation.goBack()} />
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
  const table = useGameStore((s) => s.currentTable);
  const players = useGameStore((s) => s.players);
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
            : 'Änderung bestätigt.',
        );
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
        <AppText>Das Konto hat sich geändert.</AppText>
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
  return (
    <AuthBackground>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.content}
        data={entries}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View style={s.stack}>
            <View style={s.row}>
              <AppText variant="subtitle" accessibilityRole="header">
                Tischeinladungen
              </AppText>
              <Action title="Zurück" onPress={onBack} />
            </View>
            <AppText>
              Erst nach ausdrücklicher Annahme wird ein Konto mit dem
              ausgewählten Spielerplatz verbunden.
            </AppText>
            <Action
              title={loading ? 'Wird geladen …' : 'Einladungen aktualisieren'}
              disabled={loading || busy}
              onPress={() => {
                setLoading(true);
                void load();
              }}
            />
            {!!error && <AppText accessibilityRole="alert">{error}</AppText>}
            {!!notice && <AppText accessibilityRole="alert">{notice}</AppText>}
            {pending && (
              <View style={s.card}>
                <AppText>
                  Ein Auftrag ist noch nicht abschließend bestätigt. Prüfe
                  denselben Auftrag erneut; weitere Änderungen bleiben bis dahin
                  gesperrt.
                </AppText>
                <Action
                  title="Auftrag prüfen"
                  disabled={busy || loading || storageError}
                  onPress={() => void run(pending)}
                />
              </View>
            )}
            {canInvite ? (
              <View style={s.card}>
                <AppText variant="subtitle">
                  Freund zu „{table.name}“ einladen
                </AppText>
                <AppText>
                  1. Spielerplatz auswählen. Name, bisherige Spiele und Saldo
                  dieses Platzes bleiben erhalten.
                </AppText>
                {players
                  .filter((p) => !p.userId)
                  .map((p) => (
                    <Action
                      key={p.id}
                      title={`Platz: ${p.name}`}
                      selected={playerId === p.id}
                      disabled={disabled}
                      onPress={() => setPlayerId(p.id)}
                    />
                  ))}
                {!players.some((p) => !p.userId) && (
                  <AppText>Alle Spielerplätze sind bereits verknüpft.</AppText>
                )}
                <AppText>2. Freund auswählen.</AppText>
                {friends
                  .filter((f) => !players.some((p) => p.userId === f.id))
                  .map((f) => (
                    <View key={f.id} style={s.row}>
                      <ProfileAvatar profile={f} size={32} />
                      <View style={s.flex}>
                        <Action
                          title={f.displayName}
                          selected={friendId === f.id}
                          disabled={disabled}
                          onPress={() => setFriendId(f.id)}
                        />
                      </View>
                    </View>
                  ))}
                {!friends.length && !loading && (
                  <AppText>
                    Noch keine Freunde geladen. Füge zuerst unter Profil →
                    Freunde einen Kontakt hinzu oder aktualisiere die Liste.
                  </AppText>
                )}
                <AppText>3. Berechtigung auswählen.</AppText>
                <View style={s.row}>
                  {(['read', 'write'] as const).map((r) => (
                    <Action
                      key={r}
                      title={r === 'write' ? 'Schreiben' : 'Lesen'}
                      selected={r === role}
                      disabled={disabled}
                      onPress={() => setRole(r)}
                    />
                  ))}
                </View>
                <AppText>
                  {role === 'write'
                    ? 'Spiele erfassen, korrigieren, löschen und wiederherstellen. Verwaltung bleibt beim Ersteller.'
                    : 'Tisch, Spiele und Salden ansehen; keine Änderungen.'}
                </AppText>
                <Action
                  title="Einladung senden"
                  disabled={disabled || !playerId || !friendId}
                  onPress={() => void send()}
                />
              </View>
            ) : null}
            <AppText variant="subtitle">
              {tableId
                ? 'Offene Einladungen für diesen Tisch'
                : 'Deine offenen Einladungen'}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <AppText>
            {!state
              ? loading
                ? 'Einladungen werden geladen …'
                : 'Noch kein bestätigter Stand. Bitte erneut laden.'
              : 'Keine offenen Einladungen.'}
          </AppText>
        }
        renderItem={({ item: i }) => (
          <View style={s.card}>
            <AppText variant="subtitle">{i.tableName}</AppText>
            <AppText>
              Von {i.sender.displayName} an {i.recipient.displayName}
            </AppText>
            <AppText>
              Spielerplatz: {i.playerName} ·{' '}
              {i.role === 'write' ? 'Schreiben' : 'Lesen'}
            </AppText>
            <AppText>
              Gültig bis {new Date(i.expiresAt).toLocaleDateString('de-DE')}
            </AppText>
            {!i.available && (
              <AppText>
                Diese Einladung ist nicht mehr verfügbar. Du kannst sie
                schließen.
              </AppText>
            )}
            {i.recipient.id === actor ? (
              <>
                <Action
                  title="Einladung annehmen"
                  disabled={disabled || !i.available}
                  onPress={() => void run({ action: 'accept', id: i.id })}
                />
                <Action
                  title="Einladung ablehnen"
                  disabled={disabled}
                  onPress={() => void run({ action: 'decline', id: i.id })}
                />
              </>
            ) : (
              <Action
                title="Einladung zurückziehen"
                disabled={disabled}
                onPress={() => void run({ action: 'cancel', id: i.id })}
              />
            )}
          </View>
        )}
      />
    </AuthBackground>
  );
}
function Action({
  title,
  onPress,
  disabled = false,
  selected = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[s.action, selected && s.selected, disabled && s.disabled]}
    >
      <AppText style={s.link}>{title}</AppText>
    </Pressable>
  );
}
const s = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  stack: { gap: 12 },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  card: {
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    borderRadius: 16,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 8,
  },
  selected: { borderWidth: 1, borderColor: authColors.gold },
  disabled: { opacity: 0.45 },
  link: { color: authColors.gold },
  flex: { flex: 1 },
});
