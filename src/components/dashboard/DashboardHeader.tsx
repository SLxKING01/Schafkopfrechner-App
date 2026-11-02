import { Pressable, StyleSheet } from 'react-native';

import { authColors } from '../../theme/colors';
import {
  authControlSizes,
  authInteraction,
  authRadius,
} from '../../theme/spacing';
import { AppText } from '../ui/AppText';
import { PageHeader } from '../ui/PageHeader';

type DashboardHeaderProps = {
  username: string;
  onProfile: () => void;
};

export function DashboardHeader({ username, onProfile }: DashboardHeaderProps) {
  return (
    <PageHeader
      title={`Servus, ${username}`}
      action={
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
      }
    />
  );
}

const styles = StyleSheet.create({
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
