import type { SharedTableSummary } from '../services/shared/sharedTables';
import type {
  ArchivedGameDay,
  GameRound,
  GameTable,
  Player,
} from '../types/game';
import { isPlayedRound } from './accounting';
import { roundPlayers } from './dealerOrder';
import { tableAccess } from './tableAccess';

export const quickRoundURL = 'schafkopfrechner://spiel-eintragen';

export function canOpenQuickRound(
  table: GameTable | null,
  players: Player[],
  active: boolean,
  userId: string | undefined,
) {
  // Guests may enter games at their own local tables; shared tables need an
  // account with write access (checked by tableAccess).
  return !!(
    (userId || !table?.shared) &&
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
    rounds?: GameRound[];
  },
  sharedTables: SharedTableSummary[],
  userId: string | undefined,
  hiddenIds: readonly string[],
) {
  const options = new Map<
    string,
    {
      id: string;
      name: string;
      shared: boolean;
      players: string[];
      /** Number of the next game, if known locally. */
      nextGame?: number;
    }
  >();
  function addLocal(
    table: GameTable | null,
    players: Player[],
    active: boolean,
    rounds: GameRound[] | undefined,
  ) {
    if (!table || table.shared || hiddenIds.includes(table.id)) return;
    if (canOpenQuickRound(table, players, active, userId))
      options.set(table.id, {
        id: table.id,
        name: table.name,
        shared: false,
        players: players.map((player) => player.name),
        nextGame: rounds ? rounds.filter(isPlayedRound).length + 1 : undefined,
      });
  }
  addLocal(state.currentTable, state.players, state.activeGame, state.rounds);
  for (const { table, players, rounds } of state.archivedGameDays)
    addLocal(table, players, table.isActive, rounds);

  for (const { id, ownerId, role, name, players, active } of sharedTables) {
    // Prefer verified remote permissions over any local copy.
    options.delete(id);
    if (
      userId &&
      !hiddenIds.includes(id) &&
      (role === 'write' || ownerId === userId) &&
      active &&
      [4, 5].includes(players.filter((player) => !player.isPaused).length)
    )
      options.set(id, {
        id,
        name,
        shared: true,
        players: players.map((player) => player.name),
      });
  }
  return [...options.values()];
}
