import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { createDefaultTableSettings } from '../constants/tableSettings';
import {
  clearPersistedGameState,
  getLastActiveTableId,
  type PersistedGameState,
  restorePersistedGameState,
  savePersistedGameState,
} from '../storage/gameStorage';

jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  function validate(key: string) {
    if (!/^[a-zA-Z0-9._-]+$/.test(key))
      throw new Error('Invalid SecureStore key');
  }
  return {
    getItemAsync: jest.fn(async (key: string) => {
      validate(key);
      return values.get(key) ?? null;
    }),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      validate(key);
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      validate(key);
      values.delete(key);
    }),
  };
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

it('saves, restores and clears a table using a valid native SecureStore key', async () => {
  const state: PersistedGameState = {
    currentTable: {
      id: 'table-1',
      hashCode: 'ABC123',
      name: 'Testtisch',
      createdAt: '2026-10-26T10:00:00Z',
      isActive: true,
      settings: createDefaultTableSettings(),
    },
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: true,
    savedAt: '2026-10-26T10:00:00Z',
    schemaVersion: 1,
  };
  await savePersistedGameState(state);
  expect(await restorePersistedGameState()).toEqual(state);
  expect(await getLastActiveTableId()).toBe('table-1');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'schafkopfrechner.active-table-id',
    'table-1',
  );
  await savePersistedGameState({
    ...state,
    currentTable: null,
    activeGame: false,
  });
  expect(await getLastActiveTableId()).toBeNull();
  await savePersistedGameState(state);
  await clearPersistedGameState();
  expect(await restorePersistedGameState()).toBeNull();
  expect(await getLastActiveTableId()).toBeNull();
});
