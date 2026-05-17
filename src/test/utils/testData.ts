import type { Game } from '../../models/Game';
import type { Player } from '../../models/Player';

export const players: Player[] = [
  {
    id: 'max',
    name: 'Max',
  },
  {
    id: 'simon',
    name: 'Simon',
  },
  {
    id: 'anna',
    name: 'Anna',
  },
  {
    id: 'lisa',
    name: 'Lisa',
  },
];

export function createGame(overrides: Partial<Game>): Game {
  return {
    id: 'game-1',
    winnerId: 'max',
    loserIds: ['simon'],
    amount: 10,
    createdAt: '2026-05-17T12:00:00.000Z',
    gameTypeId: 'sauspiel',
    options: {
      laufende: 0,
      schneider: false,
      schwarz: false,
    },
    matchDayId: 'match-day-1',
    ...overrides,
  };
}
