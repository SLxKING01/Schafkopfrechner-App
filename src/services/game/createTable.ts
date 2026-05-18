import * as crypto from 'expo-crypto';

import type { CreateTablePayload, GameTable } from '../../types/game';

export function createGameTable(payload: CreateTablePayload): GameTable {
  // TODO: persist table in Supabase when multiplayer sync is introduced.
  return {
    id: crypto.randomUUID(),
    name: payload.name.trim(),
    createdAt: new Date().toISOString(),
    isActive: true,
  };
}
