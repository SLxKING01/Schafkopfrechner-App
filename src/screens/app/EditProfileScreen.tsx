import {
  type NavigationAction,
  usePreventRemove,
} from '@react-navigation/native';
import * as crypto from 'expo-crypto';
import { CalendarDays, User } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AuthInput } from '../../components/auth/AuthInput';
import { GoldButton } from '../../components/auth/GoldButton';
import { AnimalAvatar } from '../../components/game/AnimalAvatar';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { AppText } from '../../components/ui/AppText';
import {
  ANIMAL_AVATAR_IDS,
  ANIMAL_AVATAR_LABELS,
  PROFILE_ACCENT_LABELS,
  PROFILE_ACCENTS,
} from '../../constants/profileCustomization';
import { useOwnProfile } from '../../hooks/useOwnProfile';
import type { AppStackScreenProps } from '../../navigation/types';
import {
  removeLocalProfilePhoto,
  selectProfilePhoto,
} from '../../services/profile/profilePhoto';
import {
  assertProfileActor,
  readOwnProfile,
  saveOwnProfile,
} from '../../services/profile/profiles';
import {
  keepProfileDraft,
  removeProfileDraft,
  restoreProfileDraft,
} from '../../services/profile/profileStorage';
import { useAuthStore } from '../../store/authStore';
import { useProfileAppearanceStore } from '../../store/profileAppearanceStore';
import { acceptOwnProfile, refreshOwnProfile } from '../../store/profileStore';
import { authColors as c, authRadius, authSpacing as sp } from '../../theme';
import type {
  OwnProfile,
  ProfileDraft,
  ProfileFields,
} from '../../types/profile';
import {
  birthDateFromInput,
  birthDateInput,
  profileFields,
  validateProfile,
} from '../../utils/profile';

export function EditProfileScreen({
  navigation,
}: AppStackScreenProps<'EditProfile'>) {
  const { profile, error, loading } = useOwnProfile();
  const actor = useAuthStore((state) => state.user?.id);
  const closeRef = useRef<() => void>(() => {});
  const action = useRef<NavigationAction | null>(null);
  const [allowLeave, setAllowLeave] = useState(false);
  usePreventRemove(!allowLeave && !!profile, ({ data }) => {
    action.current = data.action;
    closeRef.current();
  });
  useEffect(() => {
    if (allowLeave) {
      if (action.current) navigation.dispatch(action.current);
      else navigation.goBack();
    }
  }, [allowLeave, navigation]);
  useEffect(() => {
    if (actor) void refreshOwnProfile(actor);
  }, [actor]);
  if (profile)
    return (
      <ProfileEditor
        key={profile.id}
        initialProfile={profile}
        onDone={() => setAllowLeave(true)}
        requestCloseRef={closeRef}
      />
    );
  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={s.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <AppText variant="subtitle">
          {loading
            ? 'Profil wird geladen …'
            : 'Profil konnte nicht geladen werden'}
        </AppText>
        {error ? (
          <AppText selectable accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <GoldButton
          title="Erneut laden"
          disabled={loading || !actor}
          onPress={() => actor && refreshOwnProfile(actor)}
        />
        <GoldButton title="Zurück" onPress={() => navigation.goBack()} />
      </ScrollView>
    </AuthBackground>
  );
}

export function ProfileEditor({
  initialProfile,
  onDone,
  requestCloseRef,
}: {
  initialProfile: OwnProfile;
  onDone: () => void;
  requestCloseRef?: { current: () => void };
}) {
  const actor = initialProfile.id;
  const userId = useAuthStore((state) => state.user?.id);
  const email = useAuthStore((state) => state.user?.email);
  const [draft, setDraft] = useState<ProfileDraft>(() => ({
    fields: profileFields(initialProfile),
    version: initialProfile.version,
    operationId: crypto.randomUUID(),
  }));
  const [birthText, setBirthText] = useState(
    birthDateInput(initialProfile.birthDate),
  );
  const [loading, setLoading] = useState(true);
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [closeChoice, setCloseChoice] = useState(false);
  const [showAnimals, setShowAnimals] = useState(false);
  const [conflict, setConflict] = useState<OwnProfile | null>(null);
  const [showConflict, setShowConflict] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const saved = useRef<OwnProfile | null>(null);
  const oldLook = useProfileAppearanceStore();
  const errors = validateProfile(draft.fields);
  const disabled =
    busy ||
    picking ||
    loading ||
    draftLoadFailed ||
    !!draft.uncertain ||
    userId !== actor;
  const dirty =
    !!draft.photoUri ||
    JSON.stringify(draft.fields) !==
      JSON.stringify(profileFields(initialProfile));
  useEffect(() => {
    alive.current = true;
    void restoreProfileDraft(actor)
      .then((restored) => {
        if (
          !alive.current ||
          useAuthStore.getState().user?.id !== actor ||
          !restored
        )
          return;
        setDraft(restored);
        setBirthText(birthDateInput(restored.fields.birthDate));
      })
      .catch(() => {
        if (alive.current) {
          setDraftLoadFailed(true);
          setError(
            'Der gespeicherte Entwurf konnte nicht geladen werden. Bitte erneut öffnen, bevor du Änderungen speicherst.',
          );
        }
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, [actor, restoreAttempt]);

  function patch(fields: Partial<ProfileFields>, photoUri?: string | null) {
    if (disabled) return;
    setDraft((previous) => ({
      ...previous,
      fields: { ...previous.fields, ...fields },
      operationId: crypto.randomUUID(),
      uncertain: false,
      ...(photoUri !== undefined ? { photoUri: photoUri ?? undefined } : {}),
    }));
    setError('');
  }
  async function choosePhoto() {
    if (disabled || lock.current) return;
    lock.current = true;
    setPicking(true);
    setError('');
    try {
      const uri = await selectProfilePhoto(actor);
      if (alive.current && uri && useAuthStore.getState().user?.id === actor)
        setDraft((previous) => ({
          ...previous,
          photoUri: uri,
          fields: { ...previous.fields, avatarKind: 'photo' },
          operationId: crypto.randomUUID(),
          uncertain: false,
        }));
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Das Foto konnte nicht ausgewählt werden.',
        );
    } finally {
      lock.current = false;
      if (alive.current) setPicking(false);
    }
  }
  async function save() {
    if (
      lock.current ||
      loading ||
      draftLoadFailed ||
      userId !== actor ||
      (!draft.uncertain && Object.keys(errors).length)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const profile = saved.current ?? (await saveOwnProfile(actor, draft));
      saved.current = profile;
      assertProfileActor(actor);
      acceptOwnProfile(profile);
      await removeProfileDraft(actor);
      removeLocalProfilePhoto(actor, draft.photoUri);
      if (alive.current && useAuthStore.getState().user?.id === actor) onDone();
    } catch (reason) {
      if (!alive.current || useAuthStore.getState().user?.id !== actor) return;
      const failure = reason as { code?: string; mayHaveCommitted?: boolean };
      const uncertain = !!saved.current || failure.mayHaveCommitted === true;
      setDraft((previous) => ({ ...previous, uncertain }));
      setError(
        `${saved.current ? 'Profil gespeichert; der lokale Entwurf konnte noch nicht entfernt werden.' : 'Speichern nicht bestätigt. Deine Eingabe bleibt erhalten.'} ${reason instanceof Error ? reason.message : 'Bitte erneut versuchen.'}${uncertain ? ' Bitte erneut speichern, um den Stand zu bestätigen. Bis dahin ist die Bearbeitung gesperrt.' : ''}`,
      );
      if (failure.code === 'PT409') {
        try {
          const current = await readOwnProfile(actor);
          if (alive.current) setConflict(current);
        } catch {
          /* Retry remains available. */
        }
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function leave(keep: boolean) {
    if (lock.current || userId !== actor) return;
    lock.current = true;
    setBusy(true);
    try {
      if (keep) await keepProfileDraft(actor, draft);
      else {
        await removeProfileDraft(actor);
        removeLocalProfilePhoto(actor, draft.photoUri);
      }
      assertProfileActor(actor);
      onDone();
    } catch {
      if (alive.current)
        setError(
          'Der Entwurf konnte nicht gesichert oder entfernt werden. Bitte erneut versuchen.',
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function rebase(keep: boolean) {
    if (!conflict || busy) return;
    const fields = keep ? draft.fields : profileFields(conflict);
    if (!keep) removeLocalProfilePhoto(actor, draft.photoUri);
    setDraft({
      fields,
      version: conflict.version,
      operationId: crypto.randomUUID(),
      ...(keep && draft.photoUri ? { photoUri: draft.photoUri } : {}),
    });
    setBirthText(birthDateInput(fields.birthDate));
    setConflict(null);
    setShowConflict(false);
    setError('');
  }
  const requestClose = () => {
    if (lock.current || loading) return;
    if (dirty || draft.uncertain) setCloseChoice(true);
    else onDone();
  };
  useEffect(() => {
    if (requestCloseRef) requestCloseRef.current = requestClose;
  });
  return (
    <AuthBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <View style={s.heading}>
            <AppText accessibilityRole="header" variant="subtitle">
              Profil bearbeiten
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={requestClose}
              disabled={busy || picking || loading}
              style={s.action}
            >
              <AppText>Abbrechen</AppText>
            </Pressable>
          </View>
          <View style={s.preview}>
            <ProfileAvatar
              profile={draft.fields}
              previewUri={draft.photoUri}
              size={96}
            />
            <AppText style={s.hint}>
              Vorschau · Erst „Speichern“ übernimmt Änderungen.
            </AppText>
          </View>
          <GoldButton
            title={picking ? 'Foto wird vorbereitet …' : 'Foto auswählen'}
            disabled={disabled}
            onPress={choosePhoto}
          />
          <View style={s.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => setShowAnimals(!showAnimals)}
              style={s.action}
            >
              <AppText>Tieravatar wählen</AppText>
            </Pressable>
            {draft.fields.avatarKind === 'photo' || draft.photoUri ? (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() =>
                  patch(
                    {
                      avatarKind: draft.fields.animalId ? 'animal' : 'none',
                      photoPath: null,
                    },
                    null,
                  )
                }
                style={s.action}
              >
                <AppText>Foto entfernen</AppText>
              </Pressable>
            ) : null}
          </View>
          {showAnimals ? (
            <View style={s.animals}>
              {ANIMAL_AVATAR_IDS.map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tieravatar ${ANIMAL_AVATAR_LABELS[id]}`}
                  accessibilityState={{
                    selected:
                      draft.fields.avatarKind === 'animal' &&
                      draft.fields.animalId === id,
                  }}
                  disabled={disabled}
                  onPress={() =>
                    patch(
                      { avatarKind: 'animal', animalId: id, photoPath: null },
                      null,
                    )
                  }
                  style={s.action}
                >
                  <AnimalAvatar
                    animalId={id}
                    accentColor={PROFILE_ACCENTS[draft.fields.accentId]}
                  />
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() =>
                  patch(
                    { avatarKind: 'none', animalId: null, photoPath: null },
                    null,
                  )
                }
                style={s.action}
              >
                <AppText>Kein Bild</AppText>
              </Pressable>
            </View>
          ) : null}
          {initialProfile.avatarKind === 'none' && !initialProfile.photoPath ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              style={s.action}
              onPress={() =>
                patch(
                  {
                    avatarKind: 'animal',
                    animalId: oldLook.avatarId,
                    accentId: oldLook.accentId,
                    photoPath: null,
                  },
                  null,
                )
              }
            >
              <AppText>Look von diesem Gerät übernehmen</AppText>
            </Pressable>
          ) : null}
          <AppText>Anzeigename *</AppText>
          <AuthInput
            icon={User}
            accessibilityLabel="Anzeigename"
            value={draft.fields.displayName}
            editable={!disabled}
            maxLength={80}
            onChangeText={(displayName) => patch({ displayName })}
            hasError={!!errors.displayName}
          />
          <AppText style={s.hint}>
            So sehen dich andere in der Kontosuche und am Tisch.
          </AppText>
          {errors.displayName ? (
            <AppText selectable style={s.error}>
              {errors.displayName}
            </AppText>
          ) : null}
          {email ? (
            <View>
              <AppText>E-Mail-Adresse</AppText>
              <AppText selectable style={s.hint}>
                {email}
              </AppText>
            </View>
          ) : null}
          <AppText accessibilityRole="header" variant="subtitle">
            Private Angaben
          </AppText>
          <AppText style={s.hint}>
            Freiwillig und nur für dich sichtbar.
          </AppText>
          <AppText>Vorname</AppText>
          <AuthInput
            icon={User}
            accessibilityLabel="Vorname"
            value={draft.fields.firstName}
            editable={!disabled}
            maxLength={160}
            autoComplete="given-name"
            onChangeText={(firstName) => patch({ firstName })}
          />
          {errors.firstName ? (
            <AppText style={s.error}>{errors.firstName}</AppText>
          ) : null}
          <AppText>Nachname</AppText>
          <AuthInput
            icon={User}
            accessibilityLabel="Nachname"
            value={draft.fields.lastName}
            editable={!disabled}
            maxLength={160}
            autoComplete="family-name"
            onChangeText={(lastName) => patch({ lastName })}
          />
          {errors.lastName ? (
            <AppText style={s.error}>{errors.lastName}</AppText>
          ) : null}
          <AppText>Geburtsdatum</AppText>
          <AuthInput
            icon={CalendarDays}
            accessibilityLabel="Geburtsdatum"
            placeholder="TT.MM.JJJJ"
            keyboardType="number-pad"
            value={birthText}
            editable={!disabled}
            onChangeText={(value) => {
              if (!disabled) {
                const input = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
                  ? birthDateInput(value.trim())
                  : value;
                const digits = input.replace(/\D/g, '').slice(0, 8);
                const formatted = [
                  digits.slice(0, 2),
                  digits.slice(2, 4),
                  digits.slice(4),
                ]
                  .filter(Boolean)
                  .join('.');
                setBirthText(formatted);
                patch({ birthDate: birthDateFromInput(formatted) });
              }
            }}
            hasError={!!errors.birthDate}
          />
          <AppText style={s.hint}>
            Optional. Acht Ziffern eingeben, zum Beispiel 05031990. Die Punkte
            werden automatisch ergänzt. Das Datum bleibt privat.
          </AppText>
          {errors.birthDate ? (
            <AppText selectable style={s.error}>
              {errors.birthDate}
            </AppText>
          ) : null}
          <AppText accessibilityRole="header" variant="subtitle">
            Akzentfarbe
          </AppText>
          <View style={s.actions}>
            {(
              Object.keys(PROFILE_ACCENTS) as (keyof typeof PROFILE_ACCENTS)[]
            ).map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`Akzentfarbe ${PROFILE_ACCENT_LABELS[id]}`}
                accessibilityState={{ selected: draft.fields.accentId === id }}
                disabled={disabled}
                onPress={() => patch({ accentId: id })}
                style={[
                  s.swatch,
                  {
                    backgroundColor: PROFILE_ACCENTS[id],
                    borderColor:
                      draft.fields.accentId === id ? c.gold : c.borderSoft,
                  },
                ]}
              />
            ))}
          </View>
          {error ? (
            <AppText selectable accessibilityRole="alert" style={s.error}>
              {error}
            </AppText>
          ) : null}
          {conflict ? (
            <View style={s.card}>
              <AppText>
                Das Profil wurde auf einem anderen Gerät geändert.
              </AppText>
              <GoldButton
                title={
                  showConflict
                    ? 'Serverstand ausblenden'
                    : 'Aktuellen Stand ansehen'
                }
                disabled={busy}
                onPress={() => setShowConflict(!showConflict)}
              />
              {showConflict ? (
                <>
                  <ProfileAvatar profile={conflict} />
                  <AppText selectable>
                    {conflict.displayName}
                    {'\n'}Vorname: {conflict.firstName || '—'}
                    {'\n'}Nachname: {conflict.lastName || '—'}
                    {'\n'}Geburtsdatum:{' '}
                    {birthDateInput(conflict.birthDate) || '—'}
                  </AppText>
                </>
              ) : null}
              <GoldButton
                title="Serverstand übernehmen"
                disabled={busy}
                onPress={() => rebase(false)}
              />
              <GoldButton
                title="Eigene Änderungen auf diesen Stand anwenden"
                disabled={busy}
                onPress={() => rebase(true)}
              />
            </View>
          ) : null}
          {draftLoadFailed ? (
            <GoldButton
              title="Entwurf erneut laden"
              onPress={() => {
                setLoading(true);
                setDraftLoadFailed(false);
                setError('');
                setRestoreAttempt((value) => value + 1);
              }}
            />
          ) : null}
          <GoldButton
            title={
              draft.uncertain ? 'Speicherstand prüfen' : 'Profil speichern'
            }
            disabled={
              loading ||
              draftLoadFailed ||
              picking ||
              busy ||
              userId !== actor ||
              (!draft.uncertain && Object.keys(errors).length > 0) ||
              !!conflict
            }
            loading={busy}
            onPress={save}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={closeChoice}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (!busy) setCloseChoice(false);
        }}
      >
        <View style={s.modal}>
          <ScrollView contentContainerStyle={s.card} style={s.dialog}>
            <AppText accessibilityRole="header" variant="subtitle">
              Änderungen behalten?
            </AppText>
            <AppText>
              {draft.uncertain
                ? 'Die Serverantwort ist unklar. Behalte den Entwurf und prüfe den Speicherstand erneut.'
                : 'Deine Änderungen sind noch nicht gespeichert.'}
            </AppText>
            {error ? (
              <AppText selectable accessibilityRole="alert" style={s.error}>
                {error}
              </AppText>
            ) : null}
            <GoldButton
              title="Weiter bearbeiten"
              disabled={busy}
              onPress={() => setCloseChoice(false)}
            />
            <GoldButton
              title="Entwurf behalten"
              disabled={busy}
              onPress={() => leave(true)}
            />
            {!draft.uncertain ? (
              <GoldButton
                title="Änderungen verwerfen"
                disabled={busy}
                onPress={() => leave(false)}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </AuthBackground>
  );
}

const s = StyleSheet.create({
  content: {
    padding: sp.lgPlus,
    paddingBottom: sp.xxl,
    gap: sp.md,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: sp.sm,
  },
  preview: { alignItems: 'center', gap: sp.md, paddingVertical: sp.md },
  hint: { color: c.textSecondary, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  animals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
    padding: sp.sm,
    backgroundColor: c.surfaceElevated,
    borderRadius: authRadius.lg,
  },
  action: {
    minHeight: 48,
    minWidth: 48,
    padding: sp.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  error: { color: c.errorText, lineHeight: 21 },
  card: {
    padding: sp.lg,
    gap: sp.md,
    borderRadius: authRadius.lg,
    backgroundColor: c.surfaceElevated,
  },
  modal: {
    flex: 1,
    padding: sp.lg,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
  },
  dialog: {
    maxHeight: '90%',
    flexGrow: 0,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
