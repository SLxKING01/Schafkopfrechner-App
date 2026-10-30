import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type {
  ArchivedGameDay,
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../types/game';
import { reliableStorage } from './reliableStorage';
import { normalizeRestoredTables } from './validateGameState';

const GAME_STATE_KEY = 'schafkopfrechner:mvp-game-state';
// SecureStore rejects colons; retain the existing browser key for compatibility.
const ACTIVE_TABLE_KEY =
  Platform.OS === 'web'
    ? 'schafkopfrechner:active-table-id'
    : 'schafkopfrechner.active-table-id';

export type PersistedGameState = {
  cloudOwnerId?: string | null;
  cloudVersion?: number | null;
  cloudBaseline?: string | null;
  archivedGameDays?: ArchivedGameDay[];
  currentTable: GameTable | null;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  activeGame: boolean;
  savedAt: string;
  schemaVersion: 1;
};

async function getSecureItem(key: string) {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setSecureItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteSecureItem(key: string) {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function savePersistedGameState(state: PersistedGameState) {
  await reliableStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));

  if (state.currentTable?.id) {
    await setSecureItem(ACTIVE_TABLE_KEY, state.currentTable.id);
  } else {
    await deleteSecureItem(ACTIVE_TABLE_KEY);
  }
}

export async function restorePersistedGameState() {
  const value = await reliableStorage.getItem(GAME_STATE_KEY);

  if (!value) {
    return null;
  }

  return normalizeRestoredTables(JSON.parse(value) as PersistedGameState);
}

export async function clearPersistedGameState() {
  await reliableStorage.removeItem(GAME_STATE_KEY);
  await deleteSecureItem(ACTIVE_TABLE_KEY);
}

export async function getLastActiveTableId() {
  return getSecureItem(ACTIVE_TABLE_KEY);
}
