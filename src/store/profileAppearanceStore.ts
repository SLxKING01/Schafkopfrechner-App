import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_USER_APPEARANCE } from '../constants/profileCustomization';
import type { AnimalAvatarId, ProfileAccentId } from '../types/profile';

type ProfileAppearanceStore = {
  accentId: ProfileAccentId;
  avatarId: AnimalAvatarId;
  setAccentId: (accentId: ProfileAccentId) => void;
  setAvatarId: (avatarId: AnimalAvatarId) => void;
};

export const useProfileAppearanceStore = create<ProfileAppearanceStore>()(
  persist(
    (set) => ({
      accentId: DEFAULT_USER_APPEARANCE.accentId,
      avatarId: DEFAULT_USER_APPEARANCE.avatarId,
      setAccentId: (accentId) => set({ accentId }),
      setAvatarId: (avatarId) => set({ avatarId }),
    }),
    {
      name: 'schafkopfrechner-profile-appearance',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
