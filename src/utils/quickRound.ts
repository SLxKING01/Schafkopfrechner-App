import type { SharedTableRemote } from '../services/shared/sharedTables';
import type { ArchivedGameDay, GameTable, Player } from '../types/game';
import { roundPlayers } from './dealerOrder';
import { tableAccess } from './tableAccess';

export const quickRoundURL = 'schafkopfrechner://spiel-eintragen';

export function canOpenQuickRound(
  table: GameTable | null,
  players: Player[],
  active: boolean,
  userId: string | undefined,
) {
  return !!(
    userId &&
    active &&
    table?.isActive &&
    tableAccess(table, userId).canWrite &&
    roundPlayers(table, players, 0).length === 4
  );
}

export function quickRoundTables(
  state: {
    currentTable: GameTable | null;
    players: Player[];
    activeGame: boolean;
    archivedGameDays: ArchivedGameDay[];
  },
  sharedTables: SharedTableRemote[],
  userId: string,
  hiddenIds: readonly string[],
) {
  const options = new Map<
    string,
    { id: string; name: string; shared: boolean }
  >();
  function addLocal(
    table: GameTable | null,
    players: Player[],
    active: boolean,
  ) {
    if (!table || table.shared || hiddenIds.includes(table.id)) return;
    if (canOpenQuickRound(table, players, active, userId))
      options.set(table.id, { id: table.id, name: table.name, shared: false });
  }
  addLocal(state.currentTable, state.players, state.activeGame);
  for (const { table, players } of state.archivedGameDays)
    addLocal(table, players, table.isActive);

  for (const { id, ownerId, role, payload } of sharedTables) {
    const { currentTable: table, players, activeGame } = payload;
    // Prefer verified remote permissions over any local copy.
    options.delete(id);
    if (
      !hiddenIds.includes(id) &&
      (role === 'write' || ownerId === userId) &&
      activeGame &&
      table.isActive &&
      roundPlayers(table, players, 0).length === 4
    )
      options.set(id, { id, name: table.name, shared: true });
  }
  return [...options.values()];
}
