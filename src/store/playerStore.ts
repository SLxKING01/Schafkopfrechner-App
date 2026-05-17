import AsyncStorage from '@react-native-async-storage/async-storage';
import * as crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Player } from '../models/Player';

type PlayerStore = {
  players: Player[];
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
};

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      players: [],
      addPlayer: (name) => {
        const playerName = name.trim();

        if (!playerName) {
          return;
        }

        set((state) => ({
          players: [
            ...state.players,
            {
              id: crypto.randomUUID(),
              name: playerName,
            },
          ],
        }));
      },
      removePlayer: (id) => {
        set((state) => ({
          players: state.players.filter((player) => player.id !== id),
        }));
      },
    }),
    {
      name: 'schafkopfrechner-players',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ players: state.players }),
    },
  ),
);
