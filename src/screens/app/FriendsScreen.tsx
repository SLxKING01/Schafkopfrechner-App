import { useIsFocused } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as crypto from 'expo-crypto';
import { Search } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AuthInput } from '../../components/auth/AuthInput';
import { GoldButton } from '../../components/auth/GoldButton';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { AppText } from '../../components/ui/AppText';
import type { AppStackScreenProps } from '../../navigation/types';
import { assertFriendActor, findFriend } from '../../services/friends/friends';
import { useAuthStore } from '../../store/authStore';
import {
  refreshFriends,
  runFriendCommand,
  useFriendsStore,
} from '../../store/friendsStore';
import { authColors as c, authRadius, authSpacing as sp } from '../../theme';
import type {
  FriendAction,
  FriendCommand,
  FriendEntry,
  FriendRelation,
  FriendSearch,
} from '../../types/friends';
import {
  formatFriendCode,
  normalizeFriendCode,
  validFriendCode,
} from '../../utils/friends';

type Mode = 'friends' | 'requests' | 'blocked';
type Confirmation = {
  action: 'remove' | 'block' | 'unblock';
  entry: FriendEntry;
};
export function FriendsScreen({ navigation }: AppStackScreenProps<'Friends'>) {
  const actor = useAuthStore((state) => state.user?.id);
  const focused = useIsFocused();
  if (!actor)
    return (
      <AuthBackground>
        <View style={s.content}>
          <AppText>Bitte zuerst anmelden.</AppText>
          <GoldButton title="Zurück" onPress={() => navigation.goBack()} />
        </View>
      </AuthBackground>
    );
  return (
    <FriendsContent
      key={actor}
      actor={actor}
      active={focused}
      onBack={() => navigation.goBack()}
    />
  );
}

export function FriendsContent({
  actor,
  active = true,
  onBack,
}: {
  actor: string;
  active?: boolean;
  onBack: () => void;
}) {
  const currentActor = useAuthStore((state) => state.user?.id);
  const cache = useFriendsStore();
  const own = cache.ownerId === actor && currentActor === actor;
  const data = own ? cache.state : null;
  const pending = own ? cache.pending : null;
  const busy = own && cache.busy;
  const loading = !own || cache.loading;
  const unavailable =
    !data ||
    loading ||
    busy ||
    !!pending ||
    cache.storageBlocked ||
    currentActor !== actor;
  const [mode, setMode] = useState<Mode>('friends');
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<FriendSearch | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const searchSequence = useRef(0);
  const mutationLock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!active || currentActor !== actor) return;
    void refreshFriends(actor);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshFriends(actor);
    });
    return () => subscription.remove();
  }, [actor, active, currentActor]);
  function updateCode(value: string) {
    searchSequence.current++;
    setSearching(false);
    setCode(value);
    setResult(null);
    setSearchError('');
    setNotice('');
  }
  async function search() {
    if (searching || unavailable || !validFriendCode(code)) return;
    const sequence = ++searchSequence.current;
    setSearching(true);
    setSearchError('');
    setResult(null);
    setNotice('');
    try {
      const found = await findFriend(actor, code);
      if (
        alive.current &&
        sequence === searchSequence.current &&
        useAuthStore.getState().user?.id === actor
      )
        setResult(found);
    } catch (reason) {
      if (
        alive.current &&
        sequence === searchSequence.current &&
        useAuthStore.getState().user?.id === actor
      )
        setSearchError(
          reason instanceof Error
            ? reason.message
            : 'Die Suche ist fehlgeschlagen. Bitte erneut versuchen.',
        );
    } finally {
      if (alive.current && sequence === searchSequence.current)
        setSearching(false);
    }
  }
  async function copyCode() {
    if (!data) return;
    try {
      // Keep clipboard invocation in the user gesture, including Safari/WebKit.
      await Clipboard.setStringAsync(formatFriendCode(data.code), {
        android: { isSensitive: true },
      });
      assertFriendActor(actor);
      if (alive.current) {
        setNotice('Freundescode kopiert.');
        AccessibilityInfo.announceForAccessibility('Freundescode kopiert.');
      }
    } catch {
      if (alive.current && useAuthStore.getState().user?.id === actor)
        setNotice(
          'Kopieren nicht möglich. Du kannst den angezeigten Code markieren und kopieren.',
        );
    }
  }
  async function act(
    action: FriendAction,
    entry: FriendEntry,
    retry?: FriendCommand,
  ) {
    if (
      mutationLock.current ||
      busy ||
      currentActor !== actor ||
      (!retry && unavailable)
    )
      return;
    mutationLock.current = true;
    setNotice('');
    setSearchError('');
    searchSequence.current++;
    setSearching(false);
    const command: FriendCommand = retry ?? {
      action,
      targetId: entry.profile.id,
      expectedVersion: entry.pairVersion,
      referenceId:
        action === 'unblock'
          ? entry.blockId
          : ['accept', 'decline', 'cancel'].includes(action)
            ? entry.requestId
            : null,
      code: action === 'send' ? normalizeFriendCode(code) : null,
      operationId: crypto.randomUUID(),
    };
    try {
      const outcome = await runFriendCommand(actor, command);
      if (!alive.current || useAuthStore.getState().user?.id !== actor) return;
      if (outcome.success) {
        setConfirmation(null);
        setResult(null);
        setNotice(
          retry
            ? 'Auftrag geprüft. Der aktuelle Stand ist geladen.'
            : 'Änderung bestätigt. Die Liste ist aktualisiert.',
        );
        if (action === 'send') setMode('requests');
        if (action === 'block') setMode('blocked');
      } else if (
        ['STALE', 'CONTACT_UNAVAILABLE'].includes(outcome.code ?? '')
      ) {
        setConfirmation(null);
        setResult(null);
      }
    } finally {
      mutationLock.current = false;
    }
  }
  async function retryPending() {
    if (!pending || busy || mutationLock.current) return;
    // The old row need no longer exist. Retry the persisted command unchanged.
    const entry = {
      profile: { id: pending.targetId },
      pairVersion: pending.expectedVersion,
    } as FriendEntry;
    await act(pending.action, entry, pending);
  }
  function rowActions(
    entry: FriendEntry,
    relation: FriendRelation | 'blocked',
  ) {
    return (
      <View style={s.actions}>
        {relation === 'none' ? (
          <GoldButton
            title="Anfrage senden"
            disabled={unavailable}
            onPress={() => act('send', entry)}
          />
        ) : null}
        {relation === 'incoming' ? (
          <>
            <GoldButton
              title="Annehmen"
              disabled={unavailable}
              onPress={() => act('accept', entry)}
            />
            <TextAction
              title="Ablehnen"
              disabled={unavailable}
              onPress={() => act('decline', entry)}
            />
          </>
        ) : null}
        {relation === 'outgoing' ? (
          <TextAction
            title="Anfrage zurückziehen"
            disabled={unavailable}
            onPress={() => act('cancel', entry)}
          />
        ) : null}
        {relation === 'friend' ? (
          <TextAction
            title="Freund entfernen"
            disabled={unavailable}
            onPress={() => setConfirmation({ action: 'remove', entry })}
          />
        ) : null}
        {relation === 'blocked' ? (
          <TextAction
            title="Entblockieren"
            disabled={unavailable}
            onPress={() => setConfirmation({ action: 'unblock', entry })}
          />
        ) : (
          <TextAction
            title="Blockieren"
            disabled={unavailable}
            onPress={() => setConfirmation({ action: 'block', entry })}
          />
        )}
      </View>
    );
  }
  const sections: {
    key: string;
    title: string;
    relation: FriendRelation | 'blocked';
    data: FriendEntry[];
  }[] =
    mode === 'friends'
      ? [
          {
            key: 'friends',
            title: 'Deine Freunde',
            relation: 'friend',
            data: data?.friends ?? [],
          },
        ]
      : mode === 'blocked'
        ? [
            {
              key: 'blocked',
              title: 'Von dir blockiert',
              relation: 'blocked',
              data: data?.blocked ?? [],
            },
          ]
        : [
            {
              key: 'incoming',
              title: 'Eingehende Anfragen',
              relation: 'incoming',
              data: data?.incoming ?? [],
            },
            {
              key: 'outgoing',
              title: 'Ausgehende Anfragen',
              relation: 'outgoing',
              data: data?.outgoing ?? [],
            },
          ];
  if (currentActor !== actor)
    return (
      <AuthBackground>
        <View style={s.content}>
          <AppText>
            Das Konto hat sich geändert. Bitte die Freunde-Ansicht erneut
            öffnen.
          </AppText>
          <TextAction title="Zurück" onPress={onBack} />
        </View>
      </AuthBackground>
    );
  const header = (
    <View style={s.header}>
      <View style={s.heading}>
        <AppText accessibilityRole="header" variant="subtitle">
          Freunde
        </AppText>
        <TextAction title="Zurück" onPress={onBack} />
      </View>
      {data ? (
        <View style={s.card}>
          <AppText>Mein Freundescode</AppText>
          <AppText
            selectable
            accessibilityLabel="Mein Freundescode"
            style={s.code}
          >
            {formatFriendCode(data.code)}
          </AppText>
          <TextAction title="Code kopieren" onPress={copyCode} />
          <AppText style={s.hint}>
            Teile deinen Code mit Personen, die du hinzufügen möchtest. Andere
            sehen deinen Anzeigenamen und dein Profilbild.
          </AppText>
        </View>
      ) : null}
      <GoldButton
        title={adding ? 'Freundessuche schließen' : 'Freund hinzufügen'}
        onPress={() => {
          setAdding(!adding);
          setSearchError('');
        }}
        disabled={loading && !data}
      />
      {adding ? (
        <View style={s.card}>
          <AppText>Vollständiger Freundescode</AppText>
          <AuthInput
            icon={Search}
            accessibilityLabel="Freundescode eingeben"
            placeholder="XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
            value={code}
            onChangeText={updateCode}
            editable={!busy && !pending}
            onSubmitEditing={search}
          />
          {code && !validFriendCode(code) ? (
            <AppText style={s.hint}>
              Bitte alle zwölf Zeichen des Codes eingeben.
            </AppText>
          ) : null}
          <GoldButton
            title={searching ? 'Kontakt wird gesucht …' : 'Kontakt suchen'}
            loading={searching}
            disabled={searching || unavailable || !validFriendCode(code)}
            onPress={search}
          />
          {searchError ? (
            <AppText selectable accessibilityRole="alert" style={s.error}>
              {searchError}
            </AppText>
          ) : null}
          {result?.status === 'not_found' ? (
            <AppText style={s.hint}>
              Kein verfügbarer Kontakt für diesen Code gefunden. Bitte prüfe den
              vollständigen Code.
            </AppText>
          ) : null}
          {result?.status === 'self' ? (
            <AppText style={s.hint}>
              Das ist dein eigener Code. Du kannst dir selbst keine Anfrage
              senden.
            </AppText>
          ) : null}
          {result?.status === 'invalid' ? (
            <AppText style={s.hint}>
              Bitte einen gültigen vollständigen Freundescode eingeben.
            </AppText>
          ) : null}
          {result?.entry ? (
            <View style={s.found}>
              <ContactIdentity entry={result.entry} />
              <AppText style={s.hint}>
                {result.relation === 'incoming'
                  ? 'Diese Person hat dir bereits eine Anfrage gesendet. Du kannst sie ausdrücklich annehmen.'
                  : result.relation === 'outgoing'
                    ? 'Deine Anfrage ist bereits offen.'
                    : result.relation === 'friend'
                      ? 'Ihr seid bereits befreundet.'
                      : 'Prüfe Name und Bild, bevor du die Anfrage sendest.'}
              </AppText>
              {rowActions(result.entry, result.relation ?? 'none')}
            </View>
          ) : null}
        </View>
      ) : null}
      <View accessibilityRole="tablist" style={s.tabs}>
        {(['friends', 'requests', 'blocked'] as Mode[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === item }}
            accessibilityLabel={
              item === 'friends'
                ? 'Freundesliste'
                : item === 'requests'
                  ? 'Anfragen'
                  : 'Blockierte Kontakte'
            }
            onPress={() => setMode(item)}
            style={[s.tab, mode === item && s.selected]}
          >
            <AppText>
              {item === 'friends'
                ? `Freunde (${data?.friends.length ?? 0})`
                : item === 'requests'
                  ? `Anfragen (${(data?.incoming.length ?? 0) + (data?.outgoing.length ?? 0)})`
                  : 'Blockiert'}
            </AppText>
          </Pressable>
        ))}
      </View>
      {pending ? (
        <View style={s.card}>
          <AppText selectable>
            Ein Kontaktauftrag ist noch nicht abschließend bestätigt. Prüfe
            denselben Auftrag erneut; weitere Kontaktänderungen bleiben bis
            dahin gesperrt.
          </AppText>
          <GoldButton
            title="Auftrag prüfen"
            disabled={busy}
            loading={busy}
            onPress={retryPending}
          />
        </View>
      ) : null}
      {own && cache.error ? (
        <AppText selectable accessibilityRole="alert" style={s.error}>
          {cache.error}
        </AppText>
      ) : null}
      {notice ? (
        <AppText selectable accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}
      {loading && !data ? (
        <AppText accessibilityLiveRegion="polite">
          Freunde werden geladen …
        </AppText>
      ) : null}
      <TextAction
        title={loading ? 'Wird aktualisiert …' : 'Liste aktualisieren'}
        disabled={loading || busy}
        onPress={() => refreshFriends(actor)}
      />
    </View>
  );
  return (
    <AuthBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SectionList<FriendEntry, (typeof sections)[number]>
          sections={data ? sections : []}
          keyExtractor={(item) => item.profile.id}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.content}
          ListHeaderComponent={header}
          refreshing={loading && !!data}
          onRefresh={() => refreshFriends(actor)}
          renderSectionHeader={({ section }) => (
            <View style={s.section}>
              <AppText accessibilityRole="header" variant="subtitle">
                {section.title}
              </AppText>
              {!section.data.length ? (
                <AppText style={s.hint}>
                  {section.key === 'friends'
                    ? 'Noch keine Freunde. Füge jemanden über seinen Freundescode hinzu.'
                    : section.key === 'blocked'
                      ? 'Du hast keine Kontakte blockiert.'
                      : 'Hier sind gerade keine offenen Anfragen.'}
                </AppText>
              ) : null}
            </View>
          )}
          renderItem={({ item, section }) => (
            <View style={s.card}>
              <ContactIdentity entry={item} />
              {rowActions(item, section.relation)}
            </View>
          )}
          ItemSeparatorComponent={ContactSeparator}
        />
      </KeyboardAvoidingView>
      <Modal
        visible={!!confirmation}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (!busy) setConfirmation(null);
        }}
      >
        {confirmation ? (
          <View style={s.modal}>
            <ScrollView style={s.dialog} contentContainerStyle={s.card}>
              <AppText accessibilityRole="header" variant="subtitle">
                {confirmation.action === 'block'
                  ? 'Kontakt blockieren?'
                  : confirmation.action === 'remove'
                    ? 'Freund entfernen?'
                    : 'Kontakt entblockieren?'}
              </AppText>
              <ContactIdentity entry={confirmation.entry} />
              <AppText selectable>
                {confirmation.action === 'block'
                  ? 'Eine bestehende Freundschaft und offene Freundschaftsanfragen werden entfernt. Neue Kontaktanfragen sind danach in beide Richtungen gesperrt. Gemeinsame Tische und bestehende Tischrechte bleiben erhalten.'
                  : confirmation.action === 'remove'
                    ? 'Ihr seid danach nicht mehr befreundet. Eine neue Anfrage bleibt möglich. Bestehende gemeinsame Tischrechte bleiben erhalten.'
                    : 'Deine eigene Blockierung wird aufgehoben. Eine frühere Freundschaft oder Anfrage wird nicht wiederhergestellt.'}
              </AppText>
              {own && cache.error ? (
                <AppText selectable accessibilityRole="alert" style={s.error}>
                  {cache.error}
                </AppText>
              ) : null}
              <GoldButton
                title={
                  pending
                    ? 'Auftrag prüfen'
                    : confirmation.action === 'block'
                      ? 'Jetzt blockieren'
                      : confirmation.action === 'remove'
                        ? 'Jetzt entfernen'
                        : 'Jetzt entblockieren'
                }
                loading={busy}
                disabled={busy || cache.storageBlocked}
                onPress={() =>
                  pending
                    ? retryPending()
                    : act(confirmation.action, confirmation.entry)
                }
              />
              <TextAction
                title={pending ? 'Schließen' : 'Abbrechen'}
                disabled={busy}
                onPress={() => setConfirmation(null)}
              />
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </AuthBackground>
  );
}
function ContactIdentity({ entry }: { entry: FriendEntry }) {
  return (
    <View style={s.identity}>
      <ProfileAvatar profile={entry.profile} size={44} />
      <AppText selectable style={s.name}>
        {entry.profile.displayName}
      </AppText>
    </View>
  );
}
function ContactSeparator() {
  return <View style={{ height: sp.md }} />;
}
function TextAction({
  title,
  disabled,
  onPress,
}: {
  title: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      style={[s.action, disabled && { opacity: 0.45 }]}
    >
      <AppText>{title}</AppText>
    </Pressable>
  );
}
const s = StyleSheet.create({
  content: {
    padding: sp.lgPlus,
    paddingBottom: sp.xxl,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  header: { gap: sp.md },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sp.md,
  },
  card: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.borderSoft,
    borderWidth: 1,
    borderRadius: authRadius.lg,
    padding: sp.lg,
    gap: sp.md,
  },
  code: {
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    color: c.gold,
  },
  hint: { color: c.textSecondary, fontSize: 13, lineHeight: 20 },
  error: { color: c.errorText, lineHeight: 21 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  tab: {
    padding: sp.sm,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: authRadius.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  selected: { borderColor: c.gold, backgroundColor: c.surfaceElevated },
  section: { paddingVertical: sp.lg, gap: sp.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  name: { flex: 1, flexShrink: 1, fontWeight: '600', fontSize: 17 },
  actions: { gap: sp.xs },
  action: { padding: sp.sm, minHeight: 48, justifyContent: 'center' },
  found: { gap: sp.md },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: sp.lg,
  },
  dialog: {
    maxHeight: '90%',
    flexGrow: 0,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
