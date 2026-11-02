import { create } from 'zustand';

import { reliableStorage } from '../storage/reliableStorage';

const storageKey = 'schafkopfrechner-table-visibility';
type HiddenTables = Record<string, string[]>;
type TableVisibilityState = {
  hiddenByScope: HiddenTables;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  hideTable: (scope: string, tableId: string) => Promise<void>;
};

/** Personal overview preference; shared results and payment history stay intact. */
export function createTableVisibilityStore() {
  let hydration: Promise<void> | undefined;
  let writes: Promise<void> = Promise.resolve();
  return create<TableVisibilityState>()((set, get) => ({
    hiddenByScope: {},
    hydrated: false,
    hydrate: () => {
      hydration ??= (async () => {
        const raw = await reliableStorage.getItem(storageKey);
        set({
          hiddenByScope: raw ? JSON.parse(raw).hiddenByScope : {},
          hydrated: true,
        });
      })();
      return hydration;
    },
    hideTable: (scope, tableId) => {
      const operation = writes
        .catch(() => undefined)
        .then(async () => {
          await get().hydrate();
          const hiddenByScope = get().hiddenByScope;
          const ids = hiddenByScope[scope] ?? [];
          if (ids.includes(tableId)) return;
          const next = { ...hiddenByScope, [scope]: [...ids, tableId] };
          await reliableStorage.setItem(
            storageKey,
            JSON.stringify({ schemaVersion: 1, hiddenByScope: next }),
          );
          if (!(await reliableStorage.confirmWrite(storageKey)))
            throw new Error(
              'Der Tisch konnte nicht dauerhaft aus der Übersicht entfernt werden. Bitte erneut versuchen.',
            );
          set({ hiddenByScope: next });
        });
      writes = operation;
      return operation;
    },
  }));
}

export const useTableVisibilityStore = createTableVisibilityStore();
