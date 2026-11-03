import * as crypto from 'expo-crypto';

import { normalizeTableSettings } from '../../constants/tableSettings';
import type { CreateRoundPayload, GameRound } from '../../types/game';
import { roundWinnerIds } from '../../utils/accounting';

export function createGameRound(
  tableId: string,
  payload: CreateRoundPayload,
): GameRound {
  // TODO: sync round creation to Supabase Realtime tables later.
  return {
    ...(payload.participantIds
      ? { participantIds: [...payload.participantIds] }
      : {}),
    id: crypto.randomUUID(),
    tableId,
    winnerId: payload.winnerId,
    ...(payload.winnerIds ? { winnerIds: [...payload.winnerIds] } : {}),
    loserIds: [...payload.loserIds],
    amount: payload.amount,
    gameType: payload.gameType,
    ...(payload.misdealPlayerId
      ? { misdealPlayerId: payload.misdealPlayerId }
      : {}),
    ...(payload.customAmounts
      ? { customAmounts: payload.customAmounts.map((entry) => ({ ...entry })) }
      : {}),
    ...(payload.suit ? { suit: payload.suit } : {}),
    ...(payload.stockAction ? { stockAction: payload.stockAction } : {}),
    ...(payload.stockCompletesDeal !== undefined
      ? { stockCompletesDeal: payload.stockCompletesDeal }
      : {}),
    ...(payload.declarerId
      ? {
          declarerId: payload.declarerId,
          declarerWon: roundWinnerIds(payload).includes(payload.declarerId),
        }
      : {}),
    ...(payload.partnerId ? { partnerId: payload.partnerId } : {}),
    settingsSnapshot: normalizeTableSettings(payload.settingsSnapshot),
    createdAt: new Date().toISOString(),
    ...(payload.tariffOptions
      ? { tariffOptions: { ...payload.tariffOptions } }
      : {}),
  };
}
