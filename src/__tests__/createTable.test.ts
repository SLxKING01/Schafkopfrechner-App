import { createGameTable } from '../services/game/createTable';
import type { Player } from '../types/game';

const players: Player[] = [
  {
    id: 'player-1',
    isLocal: true,
    name: 'Simon',
  },
  {
    id: 'player-2',
    isLocal: true,
    name: 'Berkay',
  },
];

describe('createGameTable', () => {
  it('creates readable table metadata with a short invite code', () => {
    const table = createGameTable({
      name: ' Freitag Stammtisch ',
      players,
    });

    expect(table.name).toBe('Freitag Stammtisch');
    expect(table.hashCode).toMatch(/^(SKF|TBL|SCH)-[2-9A-HJ-NP-Z]{4}$/);
    expect(table.createdAt).toBeTruthy();
    expect(table.isActive).toBe(true);
  });
});
