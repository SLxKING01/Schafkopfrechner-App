import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type IdentityStore = {
  selections: Record<string, Record<string, string>>;
  hydrated: boolean;
  select: (scope: string, tableId: string, playerId: string | null) => void;
};
export const useDashboardIdentityStore = create<IdentityStore>()(
  persist(
    (set) => ({
      selections: {},
      hydrated: false,
      select: (scope, tableId, playerId) =>
        set((state) => {
          const selected = { ...state.selections[scope] };
          if (playerId) selected[tableId] = playerId;
          else delete selected[tableId];
          return { selections: { ...state.selections, [scope]: selected } };
        }),
    }),
    {
      name: 'schafkopfrechner-dashboard-identity',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ selections: state.selections }),
      merge: (persisted, current) => {
        const raw = (persisted as { selections?: unknown } | undefined)
          ?.selections;
        const selections: IdentityStore['selections'] = {};
        if (raw && typeof raw === 'object' && !Array.isArray(raw))
          for (const [scope, values] of Object.entries(raw)) {
            if (values && typeof values === 'object' && !Array.isArray(values))
              selections[scope] = Object.fromEntries(
                Object.entries(values).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === 'string' && !!entry[1],
                ),
              );
          }
        return { ...current, selections, hydrated: true };
      },
      onRehydrateStorage: () => () => {
        useDashboardIdentityStore.setState({ hydrated: true });
      },
    },
  ),
);
