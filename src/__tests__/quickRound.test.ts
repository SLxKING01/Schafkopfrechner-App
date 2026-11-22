import { createGameTable } from '../services/game/createTable';
import type { SharedTableSummary } from '../services/shared/sharedTables';
import { canOpenQuickRound, quickRoundTables } from '../utils/quickRound';

const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  isLocal: true,
}));
const table = createGameTable({ name: 'Lokal', players });
const remoteTable = createGameTable({ name: 'Gemeinsam', players });
const remote: SharedTableSummary = {
  id: remoteTable.id,
  version: 1,
  ownerId: 'other',
  role: 'write',
  name: remoteTable.name,
  players,
  active: true,
};
const state = {
  currentTable: table,
  players,
  activeGame: true,
  archivedGameDays: [],
};

it('offers all eligible tables and excludes hidden, read-only and completed tables', () => {
  expect(
    quickRoundTables(state, [remote], 'user', []).map(({ id }) => id),
  ).toEqual([table.id, remote.id]);
  expect(
    quickRoundTables(state, [{ ...remote, role: 'read' }], 'user', [table.id]),
  ).toEqual([]);
  expect(
    quickRoundTables(state, [{ ...remote, active: false }], 'user', [table.id]),
  ).toEqual([]);
});

it('requires a signed-in writer and four actual participants at open time', () => {
  expect(canOpenQuickRound(table, players, true, 'user')).toBe(true);
  expect(canOpenQuickRound(table, players, true, undefined)).toBe(false);
  expect(canOpenQuickRound(table, players.slice(1), true, 'user')).toBe(false);
  expect(canOpenQuickRound(table, players, false, 'user')).toBe(false);
  const readOnly = {
    ...table,
    shared: {
      userId: 'user',
      ownerId: 'other',
      code: '',
      baseline: '',
      updatedAt: '',
      version: 1,
      role: 'read' as const,
    },
  };
  expect(canOpenQuickRound(readOnly, players, true, 'user')).toBe(false);
});
