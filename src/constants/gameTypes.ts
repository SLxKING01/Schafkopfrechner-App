import type { GameType } from '../models/GameType';

export const DEFAULT_GAME_TYPE_ID = 'sauspiel';

export const GAME_TYPES: GameType[] = [
  {
    id: DEFAULT_GAME_TYPE_ID,
    name: 'Sauspiel',
    baseAmount: 10,
  },
  {
    id: 'solo',
    name: 'Solo',
    baseAmount: 50,
  },
  {
    id: 'wenz',
    name: 'Wenz',
    baseAmount: 20,
  },
  {
    id: 'ramsch',
    name: 'Ramsch',
    baseAmount: 5,
  },
];

export const DEFAULT_GAME_TYPE = GAME_TYPES[0];

export function getGameTypeById(gameTypeId?: string): GameType {
  return (
    GAME_TYPES.find((gameType) => gameType.id === gameTypeId) ??
    DEFAULT_GAME_TYPE
  );
}
