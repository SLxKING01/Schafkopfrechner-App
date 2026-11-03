import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { PROFILE_ACCENTS } from '../../constants/profileCustomization';
import { profilePhotoUrl } from '../../services/profile/profiles';
import { useAuthStore } from '../../store/authStore';
import { authColors } from '../../theme/colors';
import type { ProfileCard } from '../../types/profile';
import { AnimalAvatar } from '../game/AnimalAvatar';
import { AppText } from '../ui/AppText';

export function ProfileAvatar({
  profile,
  previewUri,
  size = 52,
}: {
  profile?: Pick<
    ProfileCard,
    'avatarKind' | 'animalId' | 'accentId' | 'photoPath'
  > | null;
  previewUri?: string;
  size?: number;
}) {
  const actor = useAuthStore((state) => state.user?.id);
  const path = profile?.avatarKind === 'photo' ? profile.photoPath : null;
  const [source, setSource] = useState<{
    actor: string;
    path: string;
    url: string;
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (!actor || !path || previewUri) return;
    let active = true;
    const load = () => {
      void profilePhotoUrl(actor, path)
        .then((url) => {
          if (active) {
            setSource({ actor, path, url });
            setFailure(null);
          }
        })
        .catch(() => {
          if (active) setFailure(path);
        });
    };
    load();
    const timer = setInterval(load, 240000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [actor, path, previewUri]);
  const uri =
    previewUri ??
    (source && source.actor === actor && source.path === path
      ? source.url
      : undefined);
  const color = PROFILE_ACCENTS[profile?.accentId ?? 'forestGreen'];
  if (uri && failure !== uri)
    return (
      <Image
        key={uri}
        source={{ uri }}
        accessibilityLabel="Profilfoto"
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        cachePolicy="memory"
        onError={() => setFailure(uri)}
      />
    );
  if (profile?.avatarKind === 'animal' && profile.animalId)
    return (
      <AnimalAvatar
        animalId={profile.animalId}
        accentColor={color}
        size={size}
      />
    );
  return (
    <View
      accessibilityLabel="Kein Profilbild"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: authColors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText
        style={{ fontSize: size * 0.4, color: authColors.textSecondary }}
      >
        ●
      </AppText>
    </View>
  );
}
