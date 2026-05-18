import { Bell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type DashboardHeaderProps = {
  username: string;
  email?: string;
};

export function DashboardHeader({ username, email }: DashboardHeaderProps) {
  return (
    <View style={styles.container}>
      <View>
        <AppText style={styles.caption}>Schoen, dass du da bist</AppText>
        <AppText style={styles.title}>Servus, {username}</AppText>
        {email ? <AppText style={styles.email}>{email}</AppText> : null}
      </View>

      <View style={styles.actions}>
        <View style={styles.iconButton}>
          <Bell color={authColors.gold} size={18} strokeWidth={2} />
        </View>
        <View style={styles.avatar}>
          <AppText style={styles.avatarText}>{username.charAt(0)}</AppText>
          <View style={styles.statusDot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: authSpacing.lg,
  },
  caption: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    fontWeight: '700',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.title,
    fontWeight: '900',
    marginTop: authSpacing.xs,
  },
  email: {
    color: 'rgba(245, 245, 245, 0.48)',
    fontSize: authTypography.tiny,
    marginTop: authSpacing.xs,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.md,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 19, 0.8)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: authColors.gold,
    borderRadius: authRadius.lg,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: authColors.background,
    fontSize: 20,
    fontWeight: '900',
  },
  statusDot: {
    backgroundColor: authColors.accentGreen,
    borderColor: authColors.background,
    borderRadius: 6,
    borderWidth: 2,
    bottom: 1,
    height: 12,
    position: 'absolute',
    right: 1,
    width: 12,
  },
});
