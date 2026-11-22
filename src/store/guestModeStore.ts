import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type GuestModeStore = {
  /** True after "Ohne Account spielen"; the app then opens directly in guest mode. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

export const useGuestModeStore = create<GuestModeStore>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'schafkopfrechner-guest-mode',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
