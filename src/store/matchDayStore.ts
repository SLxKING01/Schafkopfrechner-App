import * as crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { MatchDay } from '../models/MatchDay';
import { reliableStorage } from '../storage/reliableStorage';
import { calculateRoundBalances } from '../utils/accounting';
import { useGameStore } from './gameStore';
import { usePlayerStore } from './playerStore';

type MatchDayStore = {
  matchDays: MatchDay[];
  activeMatchDayId: string | null;
  createMatchDay: (name: string) => void;
  setActiveMatchDay: (id: string) => void;
  removeMatchDay: (id: string) => void;
  closeMatchDay: (id: string) => boolean;
  createAndActivateNextMatchDay: () => void;
  getClosedMatchDays: () => MatchDay[];
};

function createDefaultMatchDay(): MatchDay {
  return {
    id: crypto.randomUUID(),
    name: 'Heute',
    createdAt: new Date().toISOString(),
    isActive: true,
    isClosed: false,
  };
}

function normalizeMatchDays(
  matchDays: MatchDay[],
  activeMatchDayId: string | null,
) {
  const nextMatchDays =
    matchDays.length > 0 ? matchDays : [createDefaultMatchDay()];
  const nextActiveMatchDayId =
    activeMatchDayId &&
    nextMatchDays.some((matchDay) => matchDay.id === activeMatchDayId)
      ? activeMatchDayId
      : nextMatchDays[0].id;

  return {
    activeMatchDayId: nextActiveMatchDayId,
    matchDays: nextMatchDays.map((matchDay) => ({
      ...matchDay,
      isClosed: matchDay.isClosed ?? false,
      isActive: matchDay.id === nextActiveMatchDayId,
    })),
  };
}

function createNextMatchDay(): MatchDay {
  return {
    id: crypto.randomUUID(),
    name: 'Heute',
    createdAt: new Date().toISOString(),
    isActive: true,
    isClosed: false,
  };
}

const defaultMatchDay = createDefaultMatchDay();

export const useMatchDayStore = create<MatchDayStore>()(
  persist(
    (set, get) => ({
      matchDays: [defaultMatchDay],
      activeMatchDayId: defaultMatchDay.id,
      createMatchDay: (name) => {
        const matchDayName = name.trim();

        if (!matchDayName) {
          return;
        }

        const matchDay: MatchDay = {
          id: crypto.randomUUID(),
          name: matchDayName,
          createdAt: new Date().toISOString(),
          isActive: true,
          isClosed: false,
        };

        set((state) => ({
          activeMatchDayId: matchDay.id,
          matchDays: [
            ...state.matchDays.map((existingMatchDay) => ({
              ...existingMatchDay,
              isActive: false,
            })),
            matchDay,
          ],
        }));
      },
      setActiveMatchDay: (id) => {
        set((state) => {
          if (!state.matchDays.some((matchDay) => matchDay.id === id)) {
            return state;
          }

          return {
            activeMatchDayId: id,
            matchDays: state.matchDays.map((matchDay) => ({
              ...matchDay,
              isActive: matchDay.id === id,
            })),
          };
        });
      },
      removeMatchDay: (id) => {
        set((state) => {
          if (state.matchDays.find((day) => day.id === id)?.isClosed)
            return state;
          const remainingMatchDays = state.matchDays.filter(
            (matchDay) => matchDay.id !== id,
          );
          return normalizeMatchDays(
            remainingMatchDays,
            state.activeMatchDayId === id ? null : state.activeMatchDayId,
          );
        });
      },
      closeMatchDay: (id) => {
        const current = get();
        const day = current.matchDays.find((item) => item.id === id);
        if (!day) return false;
        if (day.isClosed) return true;
        try {
          calculateRoundBalances(
            usePlayerStore.getState().players,
            useGameStore
              .getState()
              .games.filter(
                (game) => (game.matchDayId ?? current.activeMatchDayId) === id,
              ),
          );
        } catch {
          return false;
        }
        set((state) => ({
          matchDays: state.matchDays.map((matchDay) =>
            matchDay.id === id && !matchDay.isClosed
              ? {
                  ...matchDay,
                  isClosed: true,
                  closedAt: new Date().toISOString(),
                }
              : matchDay,
          ),
        }));
        return true;
      },
      createAndActivateNextMatchDay: () => {
        const nextMatchDay = createNextMatchDay();

        set((state) => ({
          activeMatchDayId: nextMatchDay.id,
          matchDays: [
            ...state.matchDays.map((matchDay) => ({
              ...matchDay,
              isActive: false,
            })),
            nextMatchDay,
          ],
        }));
      },
      getClosedMatchDays: (): MatchDay[] => {
        return get()
          .matchDays.filter((matchDay) => matchDay.isClosed)
          .sort((firstMatchDay, secondMatchDay) => {
            const firstDate = firstMatchDay.closedAt ?? firstMatchDay.createdAt;
            const secondDate =
              secondMatchDay.closedAt ?? secondMatchDay.createdAt;

            return (
              new Date(secondDate).getTime() - new Date(firstDate).getTime()
            );
          });
      },
    }),
    {
      name: 'schafkopfrechner-match-days',
      storage: createJSONStorage(() => reliableStorage),
      partialize: (state) => ({
        activeMatchDayId: state.activeMatchDayId,
        matchDays: state.matchDays,
      }),
      merge: (persisted, current) => {
        if (!persisted) return current;
        const saved = persisted as Pick<
          MatchDayStore,
          'matchDays' | 'activeMatchDayId'
        >;
        return {
          ...current,
          ...normalizeMatchDays(saved.matchDays, saved.activeMatchDayId),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        const normalizedState = normalizeMatchDays(
          state.matchDays,
          state.activeMatchDayId,
        );

        useMatchDayStore.setState(normalizedState);
      },
    },
  ),
);
