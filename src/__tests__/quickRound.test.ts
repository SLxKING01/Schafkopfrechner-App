import { createGameTable } from '../services/game/createTable';
import type { SharedTableRemote } from '../services/shared/sharedTables';
import { canOpenQuickRound, quickRoundTables } from '../utils/quickRound';

const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  isLocal: true,
}));
const table = createGameTable({ name: 'Lokal', players });
const remoteTable = createGameTable({ name: 'Gemeinsam', players });
const payload = {
  currentTable: remoteTable,
  players,
  rounds: [],
  balances: [],
  settlements: [],
  activeGame: true,
};
const remote: SharedTableRemote = {
  id: remoteTable.id,
  ownerId: 'other',
  role: 'write',
  version: 1,
  updatedAt: '',
  payload,
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
    quickRoundTables(
      state,
      [{ ...remote, payload: { ...payload, activeGame: false } }],
      'user',
      [table.id],
    ),
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
