import * as crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Player } from '../models/Player';
import { reliableStorage } from '../storage/reliableStorage';
import { roundWinnerIds } from '../utils/accounting';
import { useGameStore } from './gameStore';

type PlayerStore = {
  players: Player[];
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => boolean;
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
        if (
          useGameStore
            .getState()
            .games.some(
              (game) =>
                roundWinnerIds(game).includes(id) || game.loserIds.includes(id),
            )
        )
          return false;
        set((state) => ({
          players: state.players.filter((player) => player.id !== id),
        }));
        return true;
      },
    }),
    {
      name: 'schafkopfrechner-players',
      storage: createJSONStorage(() => reliableStorage),
      partialize: (state) => ({ players: state.players }),
      merge: (persisted, current) => ({
        ...current,
        players:
          (persisted as Pick<PlayerStore, 'players'> | undefined)?.players ??
          current.players,
      }),
    },
  ),
);
