import {
  type NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronRight,
  CreditCard,
  FileText,
  Info,
  KeyRound,
  LogOut,
  Trash2,
  UserRoundCog,
  Users,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { AppButton } from '../../components/ui/AppButton';
import { appAlert } from '../../components/ui/AppDialog';
import { AppText } from '../../components/ui/AppText';
import { InteractionSheet } from '../../components/ui/InteractionSheet';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';
import { PROFILE_ACCENTS } from '../../constants/profileCustomization';
import { useOwnProfile } from '../../hooks/useOwnProfile';
import type {
  AppStackParamList,
  AuthStackParamList,
} from '../../navigation/types';
import { deleteAccount } from '../../services/auth/deleteAccount';
import { useAuthStore } from '../../store/authStore';
import { useFriendsStore } from '../../store/friendsStore';
import { refreshOwnProfile } from '../../store/profileStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';

type SettingRow = {
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  title: string;
  subtitle?: string;
  tone?: 'default' | 'gold' | 'danger';
  onPress?: () => void;
};

type SettingsSectionProps = {
  title: string;
  rows: SettingRow[];
};

export function ProfileScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { profile, displayName: username, loading, error } = useOwnProfile();
  const accentColor = PROFILE_ACCENTS[profile?.accentId ?? 'forestGreen'];
  const email = user?.email ?? 'Nicht gesetzt';
  const userId = user?.id;
  const [showDeletion, setShowDeletion] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState('');
  const deletionLock = useRef(false);
  const openProfileEditor = () => navigation.navigate('EditProfile');
  // Guests run inside the auth stack, so Login/Register are reachable by name.
  const openAuth = (screen: 'Login' | 'Register') =>
    (navigation as unknown as NavigationProp<AuthStackParamList>).navigate(
      screen,
    );
  useFocusEffect(
    useCallback(() => {
      if (userId) void refreshOwnProfile(userId);
    }, [userId]),
  );

  async function handleLogout() {
    const { error } = await signOut();

    if (error) {
      appAlert('Abmelden fehlgeschlagen', error.message);
    }
  }

  async function handleDeleteAccount() {
    if (!userId || deletionLock.current) return;
    deletionLock.current = true;
    setDeleting(true);
    setDeletionError('');
    try {
      await deleteAccount(userId);
    } catch (reason) {
      setDeletionError(
        reason instanceof Error
          ? reason.message
          : 'Die Löschung konnte nicht bestätigt werden.',
      );
    } finally {
      deletionLock.current = false;
      setDeleting(false);
    }
  }

  const newRequests = useFriendsStore((state) =>
    userId && state.ownerId === userId
      ? (state.state?.incoming.length ?? 0)
      : 0,
  );
  const accountRows: SettingRow[] = [
    {
      icon: Users,
      title: 'Freunde',
      subtitle: newRequests
        ? `${newRequests} ${newRequests === 1 ? 'neue Anfrage' : 'neue Anfragen'}`
        : 'Freundescodes, Anfragen und blockierte Kontakte',
      onPress: () => navigation.navigate('Friends'),
    },
    {
      icon: UserRoundCog,
      title: 'Profil bearbeiten',
      subtitle: 'Anzeigename, Avatar, Akzentfarbe und Kontodaten',
      onPress: openProfileEditor,
    },
    {
      icon: KeyRound,
      title: 'Passwort zurücksetzen',
      subtitle: 'Link per E-Mail anfordern',
      onPress: () =>
        navigation.navigate('RequestPassword', {
          email: user?.email,
          fromAccount: true,
        }),
    },
    {
      icon: CreditCard,
      title: 'PayPal.Me-Link',
      subtitle: 'Für Zahlungen aus gemeinsamen Tischabrechnungen',
      tone: 'gold',
      onPress: () => navigation.navigate('PayPalMe'),
    },
  ];

  const privacyRows: SettingRow[] = [
    {
      icon: Trash2,
      title: 'Konto löschen',
      subtitle: 'Konto und persönliche Cloud-Daten dauerhaft löschen',
      tone: 'danger',
      onPress: () => {
        setDeletionError('');
        setShowDeletion(true);
      },
    },
  ];

  const legalRows: SettingRow[] = [
    {
      icon: FileText,
      title: 'Datenschutzerklärung',
      onPress: () => navigation.navigate('Legal', { page: 'privacy' }),
    },
    {
      icon: Info,
      title: 'Impressum',
      onPress: () => navigation.navigate('Legal', { page: 'imprint' }),
    },
  ];

  return (
    <AuthBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <PageHeader title="Profil" />
        {!userId ? (
          <View style={[styles.profileHeader, styles.guestCard]}>
            <View style={styles.guestRow}>
              <ProfileAvatar profile={profile} size={56} />
              <View style={styles.profileCopy}>
                <Text style={styles.name}>Du spielst als Gast</Text>
                <AppText style={styles.email}>
                  Deine Tische liegen nur auf diesem Gerät. Mit einem Account
                  werden sie gesichert und du kannst mit Freunden spielen.
                </AppText>
              </View>
            </View>
            <GoldButton title="Anmelden" onPress={() => openAuth('Login')} />
            <AppButton
              title="Account erstellen"
              variant="secondary"
              onPress={() => openAuth('Register')}
            />
          </View>
        ) : null}
        {userId ? (
          <View style={[styles.profileHeader, { borderColor: accentColor }]}>
            <View
              style={[styles.avatarGlow, { backgroundColor: accentColor }]}
            />
            <Pressable
              accessibilityLabel="Profil bearbeiten"
              accessibilityRole="button"
              onPress={openProfileEditor}
              style={({ pressed }) => [
                styles.avatarButton,
                pressed && styles.pressed,
              ]}
            >
              <ProfileAvatar profile={profile} size={64} />
            </Pressable>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.name}>
                {username}
              </Text>
              <Text numberOfLines={1} style={styles.email}>
                {email}
              </Text>
            </View>
          </View>
        ) : null}

        {userId ? (
          <>
            {loading && !profile ? (
              <Notice tone="info">Profil wird geladen …</Notice>
            ) : null}
            {error ? (
              <Notice>{`Profil konnte nicht aktualisiert werden. ${error}`}</Notice>
            ) : null}
            <SettingsSection title="Account" rows={accountRows} />
            <SettingsSection
              title="Sicherheit & Datenschutz"
              rows={privacyRows}
            />
          </>
        ) : null}
        <SettingsSection title="Rechtliches" rows={legalRows} />
        {userId ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logout,
                pressed && styles.pressed,
              ]}
            >
              <LogOut color="#D65A5A" size={18} strokeWidth={2.2} />
              <AppText style={styles.logoutText}>Abmelden</AppText>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
      <InteractionSheet
        visible={showDeletion}
        dismissible={!deleting}
        onClose={() => setShowDeletion(false)}
      >
        <View accessibilityViewIsModal style={styles.deletion}>
          <AppText accessibilityRole="header" style={styles.name}>
            Konto dauerhaft löschen?
          </AppText>
          <AppText>
            Dein Profil, Profilbilder, Freundschaften und persönliche
            Cloud-Sicherungen werden dauerhaft gelöscht. Gemeinsame Tische
            bleiben für die anderen Kontomitglieder erhalten. Lokale Spielstände
            bleiben auf diesem Gerät.
          </AppText>
          {deletionError ? (
            <AppText accessibilityRole="alert" style={styles.dangerText}>
              {deletionError}
            </AppText>
          ) : null}
          <AppButton
            title="Konto endgültig löschen"
            variant="danger"
            loading={deleting}
            onPress={handleDeleteAccount}
          />
          <AppButton
            title="Abbrechen"
            variant="secondary"
            disabled={deleting}
            onPress={() => setShowDeletion(false)}
          />
        </View>
      </InteractionSheet>
    </AuthBackground>
  );
}

function SettingsSection({ title, rows }: SettingsSectionProps) {
  return (
    <View style={styles.sectionWrap}>
      <AppText style={styles.sectionTitle}>{title}</AppText>
      <View style={styles.sectionCard}>
        {rows.map((row, index) => (
          <SettingsRow
            key={row.title}
            isLast={index === rows.length - 1}
            {...row}
          />
        ))}
      </View>
    </View>
  );
}

function SettingsRow({
  icon: Icon,
  isLast,
  subtitle,
  title,
  tone = 'default',
  onPress,
}: SettingRow & { isLast: boolean }) {
  const isDanger = tone === 'danger';
  const isGold = tone === 'gold';
  const iconColor = isDanger
    ? '#D65A5A'
    : isGold
      ? authColors.goldHighlight
      : authColors.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        !isLast && styles.settingDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <View
        style={[
          styles.settingIcon,
          isGold && styles.settingIconGold,
          isDanger && styles.settingIconDanger,
        ]}
      >
        <Icon color={iconColor} size={19} strokeWidth={2.25} />
      </View>
      <View style={styles.settingCopy}>
        <Text
          numberOfLines={1}
          style={[styles.settingTitle, isDanger && styles.dangerText]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      <ChevronRight
        color={authColors.textSecondary}
        size={18}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  deletion: {
    gap: authSpacing.md,
    padding: authSpacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    gap: authSpacing.lg,
    paddingBottom: 120,
    paddingHorizontal: authSpacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.82)',
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.md,
    minHeight: 104,
    overflow: 'hidden',
    padding: authSpacing.lg,
    shadowColor: authColors.gold,
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
  },
  guestCard: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  guestRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.md,
  },
  avatarButton: {
    borderRadius: authRadius.pill,
  },
  avatarGlow: {
    borderRadius: authRadius.pill,
    height: 84,
    left: 10,
    opacity: 0.16,
    position: 'absolute',
    top: 8,
    width: 84,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: authColors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  email: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    marginTop: authSpacing.xs,
  },
  sectionWrap: {
    gap: authSpacing.sm,
  },
  sectionTitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    fontWeight: '900',
    letterSpacing: 0.4,
    paddingHorizontal: authSpacing.xs,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: 'rgba(13, 27, 19, 0.72)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: authColors.shadow,
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.md,
    minHeight: 66,
    paddingHorizontal: authSpacing.lg,
    paddingVertical: authSpacing.md,
  },
  settingDivider: {
    borderBottomColor: 'rgba(245, 245, 245, 0.06)',
    borderBottomWidth: 1,
  },
  rowPressed: {
    backgroundColor: 'rgba(245, 245, 245, 0.035)',
    transform: [{ scale: 0.992 }],
  },
  settingIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.06)',
    borderRadius: authRadius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  settingIconGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  settingIconDanger: {
    backgroundColor: 'rgba(214, 90, 90, 0.12)',
  },
  settingCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingTitle: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '800',
  },
  settingSubtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    marginTop: 2,
  },
  dangerText: {
    color: '#F29A9A',
  },
  logout: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: authSpacing.sm,
    padding: authSpacing.md,
  },
  logoutText: {
    color: '#D65A5A',
    fontSize: authTypography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
