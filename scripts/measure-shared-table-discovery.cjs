const { Buffer } = require('node:buffer');

const players = Array.from({ length: 4 }, (_, i) => ({
  id: 'player-' + i,
  name: 'Spieler ' + i,
  isLocal: true,
}));
const tables = Array.from({ length: 2 }, (_, i) => {
  const id = 'table-' + i;
  const currentTable = {
    id,
    name: 'Spielabend ' + i,
    isActive: true,
    roundHistory: [],
  };
  const rounds = Array.from({ length: 1000 }, (_, j) => ({
    id: id + '-round-' + j,
    tableId: id,
    createdAt: '2026-11-07T10:00:00Z',
    winnerIds: ['player-0', 'player-1'],
    loserIds: ['player-2', 'player-3'],
    amount: 1.4,
    gameType: 'rufspiel',
    participantIds: players.map(({ id }) => id),
    seatOrderIds: players.map(({ id }) => id),
    roundContext: { dealerIdBefore: players[j % 4].id },
  }));
  currentTable.roundHistory = rounds.map((after, j) => ({
    id: id + '-event-' + j,
    roundId: after.id,
    sequence: j + 1,
    action: 'created',
    actor: { kind: 'account', id: 'account-a', name: 'Spieler 0' },
    after,
  }));
  return {
    id,
    version: 1001,
    updated_at: '2026-11-07T10:00:00Z',
    owner_id: 'account-a',
    sk_live_members: [{ role: 'write' }],
    payload: {
      currentTable,
      rounds,
      players,
      balances: [],
      settlements: [],
      activeGame: true,
    },
  };
});
const summary = tables.map(
  ({ id, version, owner_id, payload, sk_live_members }) => ({
    id,
    version,
    owner_id,
    name: payload.currentTable.name,
    active: payload.activeGame,
    table_active: payload.currentTable.isActive,
    players: payload.players,
    sk_live_members,
  }),
);
const size = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');
console.log({
  tables: tables.length,
  roundsPerTable: 1000,
  discoveryRequestsBefore: 1,
  discoveryRequestsAfter: 1,
  responseBeforeBytes: size(tables),
  responseAfterBytes: size(summary),
  reductionPercent: (100 * (1 - size(summary) / size(tables))).toFixed(2),
});
