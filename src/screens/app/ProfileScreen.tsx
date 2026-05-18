import { CreditCard, LogOut, Mail, Settings, User } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { AnimalAvatar } from '../../components/game/AnimalAvatar';
import { AppText } from '../../components/ui/AppText';
import {
  ANIMAL_AVATAR_IDS,
  DEFAULT_USER_APPEARANCE,
  PROFILE_ACCENTS,
} from '../../constants/profileCustomization';
import { useAuthStore } from '../../store/authStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { AnimalAvatarId, ProfileAccentId } from '../../types/profile';

export function ProfileScreen() {
  const [avatarId, setAvatarId] = useState<AnimalAvatarId>(
    DEFAULT_USER_APPEARANCE.avatarId,
  );
  const [accentId, setAccentId] = useState<ProfileAccentId>(
    DEFAULT_USER_APPEARANCE.accentId,
  );
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const accentColor = PROFILE_ACCENTS[accentId];
  const username =
    typeof user?.user_metadata.username === 'string'
      ? user.user_metadata.username
      : 'Simon';

  async function handleLogout() {
    const { error } = await signOut();

    if (error) {
      Alert.alert('Logout fehlgeschlagen', error.message);
    }
  }

  function showPrepared() {
    Alert.alert(
      'Profil vorbereitet',
      'Diese Einstellung wird später mit Supabase Profil-Daten verbunden.',
    );
  }

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { borderColor: accentColor }]}>
          <AnimalAvatar
            accentColor={accentColor}
            animalId={avatarId}
            highlighted
            size={88}
          />
          <AppText style={styles.name}>{username}</AppText>
          <AppText style={styles.email}>
            {user?.email ?? 'Account aktiv'}
          </AppText>
        </View>

        <View style={styles.customizeCard}>
          <AppText style={styles.customizeTitle}>Profil-Look</AppText>
          <AppText style={styles.customizeCopy}>
            Wähle deinen Avatar und eine dezente persönliche Farbe.
          </AppText>

          <View style={styles.avatarOptions}>
            {ANIMAL_AVATAR_IDS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setAvatarId(option)}
                style={({ pressed }) => [
                  styles.avatarOption,
                  avatarId === option && { borderColor: accentColor },
                  pressed && styles.pressed,
                ]}
              >
                <AnimalAvatar
                  accentColor={accentColor}
                  animalId={option}
                  highlighted={avatarId === option}
                  size={44}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.colorOptions}>
            {(Object.keys(PROFILE_ACCENTS) as ProfileAccentId[]).map(
              (option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  onPress={() => setAccentId(option)}
                  style={({ pressed }) => [
                    styles.colorOption,
                    {
                      backgroundColor: PROFILE_ACCENTS[option],
                      borderColor:
                        accentId === option
                          ? authColors.textPrimary
                          : 'rgba(245, 245, 245, 0.12)',
                    },
                    pressed && styles.pressed,
                  ]}
                />
              ),
            )}
          </View>
        </View>

        <View style={styles.settingsCard}>
          <ProfileRow icon={User} label="Username" value={username} />
          <ProfileRow
            icon={Mail}
            label="E-Mail"
            value={user?.email ?? 'Nicht gesetzt'}
          />
          <ProfileRow icon={CreditCard} label="PayPal" value="@schafkopf" />
          <ProfileRow icon={Settings} label="Einstellungen" value="Premium" />
        </View>

        <GoldButton title="Account bearbeiten" onPress={showPrepared} />

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

type ProfileRowProps = {
  icon: typeof User;
  label: string;
  value: string;
};

function ProfileRow({ icon: Icon, label, value }: ProfileRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon color={authColors.goldHighlight} size={18} />
      </View>
      <View style={styles.rowCopy}>
        <AppText style={styles.rowLabel}>{label}</AppText>
        <AppText style={styles.rowValue}>{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: authSpacing.xl,
    paddingBottom: 120,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.xxl,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.78)',
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    padding: authSpacing.xxl,
  },
  name: {
    color: authColors.textPrimary,
    fontSize: authTypography.title,
    fontWeight: '900',
    marginTop: authSpacing.lg,
  },
  email: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    marginTop: authSpacing.xs,
  },
  customizeCard: {
    backgroundColor: 'rgba(13, 27, 19, 0.72)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    gap: authSpacing.md,
    padding: authSpacing.lg,
  },
  customizeTitle: {
    color: authColors.textPrimary,
    fontSize: authTypography.subtitle,
    fontWeight: '900',
  },
  customizeCopy: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    lineHeight: 20,
  },
  avatarOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
  avatarOption: {
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    padding: 3,
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
  colorOption: {
    borderRadius: authRadius.pill,
    borderWidth: 2,
    height: 34,
    width: 34,
  },
  settingsCard: {
    backgroundColor: 'rgba(13, 27, 19, 0.72)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: 'rgba(245, 245, 245, 0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: authSpacing.lg,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: authRadius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowCopy: {
    marginLeft: authSpacing.md,
  },
  rowLabel: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
  },
  rowValue: {
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '800',
    marginTop: authSpacing.xs,
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
