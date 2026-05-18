import * as crypto from 'expo-crypto';

import type { CreateRoundPayload, GameRound } from '../../types/game';

export function createGameRound(
  tableId: string,
  payload: CreateRoundPayload,
): GameRound {
  // TODO: sync round creation to Supabase Realtime tables later.
  return {
    id: crypto.randomUUID(),
    tableId,
    winnerId: payload.winnerId,
    loserIds: payload.loserIds,
    amount: payload.amount,
    gameType: payload.gameType,
    createdAt: new Date().toISOString(),
  };
}
