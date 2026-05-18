import { CreditCard, LogOut, Mail, Settings, User } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { AppText } from '../../components/ui/AppText';
import { useAuthStore } from '../../store/authStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';

export function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
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
      'Diese Einstellung wird spaeter mit Supabase Profil-Daten verbunden.',
    );
  }

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{username.charAt(0)}</AppText>
          </View>
          <AppText style={styles.name}>{username}</AppText>
          <AppText style={styles.email}>
            {user?.email ?? 'Account aktiv'}
          </AppText>
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
  avatar: {
    alignItems: 'center',
    backgroundColor: authColors.gold,
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  avatarText: {
    color: authColors.background,
    fontSize: 34,
    fontWeight: '900',
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
