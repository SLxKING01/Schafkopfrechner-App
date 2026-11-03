import { Pressable, StyleSheet } from 'react-native';

import { useOwnProfile } from '../../hooks/useOwnProfile';
import { authColors } from '../../theme/colors';
import {
  authControlSizes,
  authInteraction,
  authRadius,
} from '../../theme/spacing';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { AppText } from '../ui/AppText';
import { PageHeader } from '../ui/PageHeader';

type DashboardHeaderProps = {
  username: string;
  onProfile: () => void;
};

export function DashboardHeader({ username, onProfile }: DashboardHeaderProps) {
  const { profile } = useOwnProfile();
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
          {profile ? (
            <ProfileAvatar profile={profile} size={48} />
          ) : (
            <AppText style={styles.avatarText}>
              {username.charAt(0).toUpperCase()}
            </AppText>
          )}
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
