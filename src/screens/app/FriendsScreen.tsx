import { useIsFocused } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as crypto from 'expo-crypto';
import { MoreHorizontal, Search } from 'lucide-react-native';
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
  Share,
  StyleSheet,
  View,
} from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AuthInput } from '../../components/auth/AuthInput';
import { GoldButton } from '../../components/auth/GoldButton';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
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
  async function shareCode() {
    if (!data) return;
    try {
      await Share.share({
        message: `Mein Freundescode für den Schafkopfrechner: ${formatFriendCode(data.code)}`,
      });
    } catch {
      setNotice(
        'Teilen nicht möglich. Du kannst den Code kopieren und selbst verschicken.',
      );
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
            ? 'Erneut geprüft. Der aktuelle Stand ist geladen.'
            : 'Erledigt. Die Liste ist aktualisiert.',
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
    if (relation === 'none')
      return (
        <GoldButton
          title="Anfrage senden"
          disabled={unavailable}
          onPress={() => act('send', entry)}
        />
      );
    if (relation === 'incoming')
      return (
        <View style={s.buttonRow}>
          <GoldButton
            title="Annehmen"
            disabled={unavailable}
            onPress={() => act('accept', entry)}
            style={s.flex}
          />
          <AppButton
            title="Ablehnen"
            variant="secondary"
            disabled={unavailable}
            onPress={() => act('decline', entry)}
            style={s.flex}
          />
        </View>
      );
    if (relation === 'outgoing')
      return (
        <AppButton
          title="Anfrage zurückziehen"
          variant="secondary"
          disabled={unavailable}
          onPress={() => act('cancel', entry)}
        />
      );
    if (relation === 'blocked')
      return (
        <AppButton
          title="Entblockieren"
          variant="secondary"
          disabled={unavailable}
          onPress={() => setConfirmation({ action: 'unblock', entry })}
        />
      );
    // Friends: rare actions live behind the ⋯ button of the row.
    return openMenu === entry.profile.id ? (
      <View style={s.menu}>
        <TextAction
          title="Freund entfernen"
          disabled={unavailable}
          onPress={() => {
            setOpenMenu(null);
            setConfirmation({ action: 'remove', entry });
          }}
        />
        <TextAction
          title="Blockieren"
          danger
          disabled={unavailable}
          onPress={() => {
            setOpenMenu(null);
            setConfirmation({ action: 'block', entry });
          }}
        />
      </View>
    ) : null;
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
  const incomingCount = data?.incoming.length ?? 0;
  const header = (
    <View style={s.header}>
      <PageHeader title="Freunde" onBack={onBack} />
      {data ? (
        <View style={[s.card, s.codeCard]}>
          <AppText style={s.hint}>Dein Freundescode</AppText>
          <AppText
            selectable
            accessibilityLabel="Mein Freundescode"
            style={s.code}
          >
            {formatFriendCode(data.code)}
          </AppText>
          <View style={s.buttonRow}>
            <AppButton
              title="Teilen"
              variant="secondary"
              onPress={() => void shareCode()}
              style={s.flex}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Code kopieren"
              onPress={copyCode}
              style={({ pressed }) => [
                s.secondaryButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <AppText style={s.secondaryText}>Kopieren</AppText>
            </Pressable>
          </View>
          <AppText style={s.hint}>
            Andere sehen deinen Anzeigenamen und dein Profilbild.
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
          {searchError ? <Notice>{searchError}</Notice> : null}
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
            <AppText
              numberOfLines={1}
              style={[s.tabText, mode === item && s.tabTextSelected]}
            >
              {item === 'friends'
                ? `Freunde ${data?.friends.length ?? 0}`
                : item === 'requests'
                  ? 'Anfragen'
                  : 'Blockiert'}
            </AppText>
            {item === 'requests' && incomingCount ? (
              <View style={s.badge}>
                <AppText style={s.badgeText}>{incomingCount}</AppText>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      {pending ? (
        <View style={s.card}>
          <AppText selectable>
            Eine Änderung ist noch nicht abschließend bestätigt. Prüfe sie
            erneut; weitere Änderungen an Kontakten sind bis dahin gesperrt.
          </AppText>
          <GoldButton
            title="Erneut prüfen"
            disabled={busy}
            loading={busy}
            onPress={retryPending}
          />
        </View>
      ) : null}
      {own && cache.error ? <Notice>{cache.error}</Notice> : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}
      {loading && !data ? (
        <Notice tone="info">Freunde werden geladen …</Notice>
      ) : null}
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
              <View style={s.rowHead}>
                <ContactIdentity entry={item} />
                {section.relation === 'friend' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Aktionen für ${item.profile.displayName}`}
                    accessibilityState={{
                      expanded: openMenu === item.profile.id,
                    }}
                    hitSlop={8}
                    onPress={() =>
                      setOpenMenu(
                        openMenu === item.profile.id ? null : item.profile.id,
                      )
                    }
                    style={s.more}
                  >
                    <MoreHorizontal color={c.textSecondary} size={20} />
                  </Pressable>
                ) : null}
              </View>
              {section.relation === 'incoming' ? (
                <AppText style={s.hint}>möchte mit dir befreundet sein</AppText>
              ) : null}
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
              {own && cache.error ? <Notice>{cache.error}</Notice> : null}
              <GoldButton
                title={
                  pending
                    ? 'Erneut prüfen'
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
  danger,
  onPress,
}: {
  title: string;
  disabled?: boolean;
  danger?: boolean;
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
      <AppText style={danger ? s.dangerText : undefined}>{title}</AppText>
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
  tabs: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: authRadius.pill,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: authRadius.pill,
    paddingHorizontal: sp.sm,
  },
  selected: { backgroundColor: c.gold },
  tabText: { color: c.textSecondary, fontSize: 14, fontWeight: '700' },
  tabTextSelected: { color: c.onGold },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: c.goldHighlight,
  },
  badgeText: {
    color: c.onGold,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  codeCard: { borderColor: c.borderGold },
  buttonRow: { flexDirection: 'row', gap: sp.sm },
  flex: { flex: 1 },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.borderGold,
  },
  secondaryText: { color: c.goldHighlight, fontWeight: '600' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  more: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  dangerText: { color: c.errorText },
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
