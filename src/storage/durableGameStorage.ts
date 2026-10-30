import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const GAME_STORE_KEY = 'schafkopfrechner-games';

export const useStorageStatus = create<{
  error: string | null;
  lastSavedAt: string | null;
  busy: boolean;
}>(() => ({ error: null, lastSavedAt: null, busy: false }));

let writes: Promise<void> = Promise.resolve();

// Serialize checkpoints and ordinary persistence so an older write cannot win.
export function writeGameStorage(name: string, value: string): Promise<void> {
  const operation = writes.then(async () => {
    try {
      await AsyncStorage.setItem(name, value);
      useStorageStatus.setState({
        error: null,
        lastSavedAt: new Date().toISOString(),
      });
    } catch {
      useStorageStatus.setState({
        error:
          'Speichern fehlgeschlagen. Bitte die App geöffnet lassen und erneut lokal speichern. Nicht bestätigte Änderungen sind noch nicht dauerhaft gesichert.',
      });
      throw new Error('Lokaler Speicher nicht verfügbar');
    }
  });
  writes = operation.catch(() => undefined);
  return operation;
}

export const gameStorageAdapter = {
  getItem: async (name: string) => {
    let value: string | null;
    try {
      value = await AsyncStorage.getItem(name);
    } catch {
      useStorageStatus.setState({
        error:
          'Lokaler Speicher konnte nicht gelesen werden. Bitte erneut laden.',
      });
      throw new Error('Local storage read failed');
    }
    if (value !== null) {
      try {
        const state = JSON.parse(value).state;
        if (!state || typeof state !== 'object')
          throw new Error('Invalid state');
        for (const field of [
          'games',
          'players',
          'rounds',
          'balances',
          'settlements',
          'archivedTables',
        ]) {
          if (state[field] !== undefined && !Array.isArray(state[field]))
            throw new Error('Invalid collection');
        }
        for (const entry of state.archivedTables ?? []) {
          if (
            !entry.currentTable?.id ||
            !['players', 'rounds', 'balances', 'settlements'].every((field) =>
              Array.isArray(entry[field]),
            )
          )
            throw new Error('Invalid archive');
        }
      } catch {
        useStorageStatus.setState({
          error:
            'Gespeicherter Spielstand ist nicht lesbar. Die vorhandene Sicherung wird nicht überschrieben.',
        });
        throw new Error('Invalid stored game state');
      }
    }
    return value;
  },
  removeItem: (name: string) => AsyncStorage.removeItem(name),
  // Zustand writes are asynchronous; expose failure without an unhandled rejection.
  setItem: (name: string, value: string) =>
    writeGameStorage(name, value).catch(() => undefined),
};
