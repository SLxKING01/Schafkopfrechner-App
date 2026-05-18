import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type {
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../types/game';

const GAME_STATE_KEY = 'schafkopfrechner:mvp-game-state';
const ACTIVE_TABLE_KEY = 'schafkopfrechner:active-table-id';

export type PersistedGameState = {
  currentTable: GameTable | null;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  activeGame: boolean;
  savedAt: string;
  schemaVersion: 1;
};

export async function savePersistedGameState(state: PersistedGameState) {
  await AsyncStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));

  if (state.currentTable?.id) {
    await SecureStore.setItemAsync(ACTIVE_TABLE_KEY, state.currentTable.id);
  } else {
    await SecureStore.deleteItemAsync(ACTIVE_TABLE_KEY);
  }
}

export async function restorePersistedGameState() {
  const value = await AsyncStorage.getItem(GAME_STATE_KEY);

  if (!value) {
    return null;
  }

  return JSON.parse(value) as PersistedGameState;
}

export async function clearPersistedGameState() {
  await AsyncStorage.removeItem(GAME_STATE_KEY);
  await SecureStore.deleteItemAsync(ACTIVE_TABLE_KEY);
}

export async function getLastActiveTableId() {
  return SecureStore.getItemAsync(ACTIVE_TABLE_KEY);
}
