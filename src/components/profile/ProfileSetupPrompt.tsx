import * as crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { useOwnProfile } from '../../hooks/useOwnProfile';
import { ProfileEditor } from '../../screens/app/EditProfileScreen';
import { saveOwnProfile } from '../../services/profile/profiles';
import { removeProfileDraft } from '../../services/profile/profileStorage';
import { acceptOwnProfile } from '../../store/profileStore';
import { authColors, authSpacing } from '../../theme';
import { profileFields } from '../../utils/profile';
import { GoldButton } from '../auth/GoldButton';
import { AppText } from '../ui/AppText';

export function ProfileSetupPrompt() {
  const { profile } = useOwnProfile();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = useRef<() => void>(() => {});
  const lock = useRef(false);
  async function skip() {
    if (!profile || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await saveOwnProfile(profile.id, {
        fields: profileFields(profile),
        version: profile.version,
        operationId: crypto.randomUUID(),
      });
      acceptOwnProfile(result);
      await removeProfileDraft(profile.id);
      setDismissed(profile.id);
    } catch {
      setError(
        'Die Auswahl konnte nicht gespeichert werden. Du kannst für diese Sitzung ohne Profilergänzung fortfahren.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const visible =
    !!profile && !profile.setupCompleted && dismissed !== profile.id;
  return (
    <Modal
      visible={visible}
      transparent={!editing}
      animationType="none"
      onRequestClose={() => (editing ? close.current() : skip())}
    >
      {visible && profile ? (
        editing ? (
          <ProfileEditor
            key={profile.id}
            initialProfile={profile}
            requestCloseRef={close}
            onDone={() => {
              setEditing(false);
              setDismissed(profile.id);
            }}
          />
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.65)',
              justifyContent: 'center',
              padding: authSpacing.lg,
            }}
          >
            <ScrollView
              style={{
                maxHeight: '90%',
                flexGrow: 0,
                maxWidth: 540,
                width: '100%',
                alignSelf: 'center',
              }}
              contentContainerStyle={{
                padding: authSpacing.lg,
                gap: authSpacing.lg,
                backgroundColor: authColors.surfaceElevated,
                borderRadius: 20,
              }}
            >
              <AppText accessibilityRole="header" variant="subtitle">
                Dein Profil ergänzen
              </AppText>
              <AppText>
                Wähle ein Foto oder einen Tieravatar. Vorname, Nachname und
                Geburtsdatum sind freiwillig und nur für dich sichtbar.
              </AppText>
              <GoldButton
                title="Profil ergänzen"
                disabled={busy}
                onPress={() => setEditing(true)}
              />
              <GoldButton
                title="Später"
                disabled={busy}
                loading={busy}
                onPress={skip}
              />
              {error ? (
                <>
                  <AppText selectable accessibilityRole="alert">
                    {error}
                  </AppText>
                  <GoldButton
                    title="Für diese Sitzung fortfahren"
                    onPress={() => setDismissed(profile.id)}
                  />
                </>
              ) : null}
            </ScrollView>
          </View>
        )
      ) : null}
    </Modal>
  );
}
