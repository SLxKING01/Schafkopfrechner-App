import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  Brush,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  HelpCircle,
  KeyRound,
  LayoutGrid,
  Lock,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TableProperties,
  UserRoundCog,
  Users,
  Volume2,
  WalletCards,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { AppText } from '../../components/ui/AppText';
import { PageHeader } from '../../components/ui/PageHeader';
import { PROFILE_ACCENTS } from '../../constants/profileCustomization';
import { useOwnProfile } from '../../hooks/useOwnProfile';
import { appAlert } from '../../lib/appAlert';
import type { AppStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
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
  premium?: boolean;
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
  const openProfileEditor = () => navigation.navigate('EditProfile');
  useFocusEffect(
    useCallback(() => {
      if (userId) void refreshOwnProfile(userId);
    }, [userId]),
  );

  async function handleLogout() {
    const { error } = await signOut();

    if (error) {
      appAlert('Logout fehlgeschlagen', error.message);
    }
  }

  function showPrepared(setting: string) {
    appAlert(
      setting,
      'Diese Einstellung wird später mit deinen Profil-Daten verbunden.',
    );
  }

  const accountRows: SettingRow[] = [
    {
      icon: Users,
      title: 'Freunde',
      subtitle: 'Freundescodes, Anfragen und blockierte Kontakte',
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

  const gameRows: SettingRow[] = [
    {
      icon: CircleDollarSign,
      title: 'Standard Einsatz',
      subtitle: 'Für neue Runden voreinstellen',
      onPress: () => showPrepared('Standard Einsatz'),
    },
    {
      icon: Smartphone,
      title: 'Haptisches Feedback',
      subtitle: 'Vibration bei wichtigen Aktionen',
      onPress: () => showPrepared('Haptisches Feedback'),
    },
    {
      icon: Volume2,
      title: 'Soundeffekte',
      subtitle: 'Dezente Sounds für Spielaktionen',
      onPress: () => showPrepared('Soundeffekte'),
    },
    {
      icon: Brush,
      title: 'Kartenstil',
      subtitle: 'Traditionell, modern oder kompakt',
      onPress: () => showPrepared('Kartenstil'),
    },
    {
      icon: TableProperties,
      title: 'Tisch-Einstellungen',
      subtitle: 'Regeln und Anzeige pro Tisch',
      onPress: () => showPrepared('Tisch-Einstellungen'),
    },
  ];

  const designRows: SettingRow[] = [
    {
      icon: Sparkles,
      title: 'Theme',
      subtitle: 'Dunkelgrün Premium',
      onPress: () => showPrepared('Theme'),
    },
    {
      icon: Brush,
      title: 'Karten-Design',
      subtitle: 'Optik für Spielkarten und Symbole',
      onPress: () => showPrepared('Karten-Design'),
    },
    {
      icon: LayoutGrid,
      title: 'Tabellen-Layout',
      subtitle: 'Kompakt oder ausführlich',
      onPress: () => showPrepared('Tabellen-Layout'),
    },
  ];

  const subscriptionRows: SettingRow[] = [
    {
      icon: Sparkles,
      title: 'Premium verwalten',
      subtitle: 'Status, Vorteile und Rechnungen',
      tone: 'gold',
      onPress: () => showPrepared('Premium verwalten'),
    },
    {
      icon: WalletCards,
      title: 'Verfügbare Abos',
      subtitle: 'Monatlich, jährlich oder Verein',
      tone: 'gold',
      onPress: () => showPrepared('Verfügbare Abos'),
    },
    {
      icon: CreditCard,
      title: 'Abo kündigen',
      subtitle: 'Premium bleibt bis Periodenende aktiv',
      onPress: () => showPrepared('Abo kündigen'),
    },
  ];

  const privacyRows: SettingRow[] = [
    {
      icon: Bell,
      title: 'Benachrichtigungen',
      subtitle: 'Einladungen, Ergebnisse und Hinweise',
      onPress: () => showPrepared('Benachrichtigungen'),
    },
    {
      icon: ShieldCheck,
      title: 'Datenschutzeinstellungen',
      subtitle: 'Sichtbarkeit und Datenfreigaben',
      onPress: () => showPrepared('Datenschutzeinstellungen'),
    },
    {
      icon: Smartphone,
      title: 'Apps verwalten',
      subtitle: 'Verbundene Geräte und Integrationen',
      onPress: () => showPrepared('Apps verwalten'),
    },
    {
      icon: Lock,
      title: 'Konto schließen',
      subtitle: 'Dauerhaft deaktivieren',
      tone: 'danger',
      onPress: () => showPrepared('Konto schließen'),
    },
  ];

  const supportRows: SettingRow[] = [
    {
      icon: MessageSquareText,
      title: 'Feedback senden',
      subtitle: 'Ideen, Fehler und Wünsche teilen',
      onPress: () => showPrepared('Feedback senden'),
    },
    {
      icon: HelpCircle,
      title: 'Hilfe',
      subtitle: 'Regeln, Fragen und App-Support',
      onPress: () => showPrepared('Hilfe'),
    },
    {
      icon: ShieldCheck,
      title: 'Datenschutz',
      subtitle: 'Wie deine Daten verarbeitet werden',
      onPress: () => showPrepared('Datenschutz'),
    },
    {
      icon: FileText,
      title: 'Impressum',
      subtitle: 'Rechtliche Angaben',
      onPress: () => showPrepared('Impressum'),
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
        <View style={[styles.profileHeader, { borderColor: accentColor }]}>
          <View style={[styles.avatarGlow, { backgroundColor: accentColor }]} />
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

        {loading && !profile ? <AppText>Profil wird geladen …</AppText> : null}
        {error ? (
          <AppText accessibilityRole="alert" selectable>
            Profil konnte nicht aktualisiert werden. {error}
          </AppText>
        ) : null}
        <SettingsSection title="Account" rows={accountRows} />
        <SettingsSection title="Spiel" rows={gameRows} />
        <SettingsSection title="Design" rows={designRows} />
        <SettingsSection title="Abo" rows={subscriptionRows} premium />
        <SettingsSection title="Sicherheit & Datenschutz" rows={privacyRows} />
        <SettingsSection title="Support" rows={supportRows} />

        <Pressable
          accessibilityRole="button"
          onPress={handleLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
        >
          <LogOut color="#D65A5A" size={18} strokeWidth={2.2} />
          <AppText style={styles.logoutText}>Logout</AppText>
        </Pressable>
      </ScrollView>
    </AuthBackground>
  );
}

function SettingsSection({
  title,
  rows,
  premium = false,
}: SettingsSectionProps) {
  return (
    <View style={styles.sectionWrap}>
      <AppText style={[styles.sectionTitle, premium && styles.premiumTitle]}>
        {title}
      </AppText>
      <View style={[styles.sectionCard, premium && styles.premiumCard]}>
        {rows.map((row, index) => (
          <SettingsRow
            key={row.title}
            isLast={index === rows.length - 1}
            premium={premium}
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
  premium = false,
  subtitle,
  title,
  tone = 'default',
  onPress,
}: SettingRow & { isLast: boolean; premium?: boolean }) {
  const isDanger = tone === 'danger';
  const isGold = tone === 'gold' || premium;
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
          <Text numberOfLines={1} style={styles.settingSubtitle}>
            {subtitle}
          </Text>
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
  premiumTitle: {
    color: authColors.goldHighlight,
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
  premiumCard: {
    borderColor: 'rgba(242, 201, 76, 0.24)',
    shadowColor: authColors.gold,
    shadowOpacity: 0.16,
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
