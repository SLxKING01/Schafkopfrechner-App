import { Pressable, StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import {
  authControlSizes,
  authInteraction,
  authRadius,
  authSpacing,
} from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type DashboardHeaderProps = {
  username: string;
  onProfile: () => void;
};

export function DashboardHeader({ username, onProfile }: DashboardHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <AppText accessibilityRole="header" style={styles.title}>
          Servus, {username}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profil öffnen"
        onPress={onProfile}
        style={({ pressed }) => [
          styles.avatar,
          pressed && authInteraction.pressed,
        ]}
      >
        <AppText style={styles.avatarText}>
          {username.charAt(0).toUpperCase()}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: authSpacing.lg,
    gap: authSpacing.md,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.metric,
    fontWeight: '600',
    marginTop: authSpacing.xs,
  },
  avatar: {
    alignItems: 'center',
    borderColor: authColors.gold,
    borderWidth: 1,
    borderRadius: authRadius.pill,
    height: authControlSizes.field,
    justifyContent: 'center',
    width: authControlSizes.field,
  },
  avatarText: {
    color: authColors.gold,
    fontSize: 20,
    fontWeight: '600',
  },
});
