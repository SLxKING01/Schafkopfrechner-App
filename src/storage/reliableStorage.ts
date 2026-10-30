import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

import { validateStoredValue } from './validateGameState';

type StorageIssue = { key: string; message: string; blocked: boolean };
const issues = new Map<string, StorageIssue>();
const listeners = new Set<() => void>();
let currentIssues: StorageIssue[] = [];
function report(key: string, message?: string, blocked = false) {
  const previous = issues.get(key);
  if (
    (!message && !previous) ||
    (message === previous?.message && blocked === previous?.blocked)
  )
    return;
  if (message) issues.set(key, { key, message, blocked });
  else issues.delete(key);
  currentIssues = [...issues.values()].sort(
    (a, b) => Number(b.blocked) - Number(a.blocked),
  );
  listeners.forEach((listener) => listener());
}
export const getStorageIssues = () => currentIssues;
export function subscribeStorageIssues(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Serializes each key and keeps the last validated disk version as a fallback. */
export function createReliableStorage(
  storage: StateStorage,
  validate: (key: string, value: unknown) => boolean,
  onIssue = report,
) {
  const queues = new Map<string, Promise<unknown>>();
  const blocked = new Set<string>();
  const failedWrites = new Map<string, string>();
  const recovered = new Set<string>();
  const success = (key: string) => {
    if (failedWrites.has(key)) {
      onIssue(
        key,
        'Änderungen sind noch nicht auf dem Gerät gespeichert. Bitte erneut speichern, bevor du die App schließt.',
        true,
      );
      return;
    }
    if (recovered.has(key))
      onIssue(
        key,
        'Eine beschädigte Speicherung wurde aus der letzten lokalen Sicherung wiederhergestellt. Bitte prüfe die letzten Einträge.',
      );
    else onIssue(key);
  };
  function enqueue<T>(key: string, action: () => Promise<T>): Promise<T> {
    const operation = (queues.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(action);
    queues.set(key, operation);
    return operation;
  }
  function isValid(key: string, raw: string) {
    try {
      return validate(key, JSON.parse(raw));
    } catch {
      return false;
    }
  }
  const result = {
    getItem: (key: string) =>
      enqueue(key, async () => {
        try {
          const raw = await storage.getItem(key);
          if (raw !== null && isValid(key, raw)) {
            blocked.delete(key);
            success(key);
            return raw;
          }
          const backup = await storage.getItem(key + '.backup');
          if (raw === null && backup === null) {
            blocked.delete(key);
            success(key);
            return null;
          }
          if (backup && isValid(key, backup)) {
            // Keep the damaged original for recovery instead of erasing it.
            if (raw !== null) await storage.setItem(key + '.damaged', raw);
            await storage.setItem(key, backup);
            blocked.delete(key);
            recovered.add(key);
            onIssue(
              key,
              'Eine beschädigte Speicherung wurde aus der letzten lokalen Sicherung wiederhergestellt. Bitte prüfe die letzten Einträge.',
            );
            return backup;
          }
          blocked.add(key);
          onIssue(
            key,
            'Gespeicherte Daten können nicht gelesen werden. Sie bleiben erhalten. Bitte die App neu laden; neue Eingaben werden derzeit nicht sicher gespeichert.',
            true,
          );
          return null;
        } catch {
          blocked.add(key);
          onIssue(
            key,
            'Der Gerätespeicher ist nicht erreichbar. Bitte die App neu laden, bevor du weitere Spiele einträgst.',
            true,
          );
          return null;
        }
      }),
    setItem: (key: string, value: string) =>
      enqueue(key, () => write(key, value)),
    removeItem: (key: string) =>
      enqueue(key, async () => {
        await storage.removeItem(key);
        await storage.removeItem(key + '.backup');
        failedWrites.delete(key);
        blocked.delete(key);
        recovered.delete(key);
        onIssue(key);
      }),
  } satisfies StateStorage;
  async function write(key: string, value: string) {
    if (blocked.has(key)) return;
    try {
      // Validate at the boundary before replacing any last-known-good state.
      if (!isValid(key, value)) throw new Error('Invalid snapshot');
      const previous = await storage.getItem(key);
      if (previous === value) {
        failedWrites.delete(key);
        success(key);
        return;
      }
      if (previous && isValid(key, previous))
        await storage.setItem(key + '.backup', previous);
      await storage.setItem(key, value);
      failedWrites.delete(key);
      success(key);
    } catch {
      failedWrites.set(key, value);
      onIssue(
        key,
        'Änderungen sind noch nicht auf dem Gerät gespeichert. Bitte Speicherplatz prüfen und erneut speichern, bevor du die App schließt.',
        true,
      );
    }
  }
  return {
    ...result,
    acknowledgeRecovery: (key: string) => {
      if (recovered.delete(key)) onIssue(key);
    },
    flush: async () => {
      await Promise.all([...queues.values()]);
    },
    confirmWrite: async (key: string) => {
      // A write may have been queued while its predecessor was completing.
      let pending = queues.get(key);
      while (pending) {
        await pending;
        if (queues.get(key) === pending) break;
        pending = queues.get(key);
      }
      return !!pending && !blocked.has(key) && !failedWrites.has(key);
    },
    retryWrites: async () => {
      await Promise.all(
        [...failedWrites.keys()].map((key) =>
          enqueue(key, async () => {
            const latest = failedWrites.get(key);
            if (latest !== undefined) await write(key, latest);
          }),
        ),
      );
    },
  };
}
export const reliableStorage = createReliableStorage(
  AsyncStorage,
  validateStoredValue,
);
