import type {
  ArchivedGameDay,
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../types/game';

type GameDayState = {
  currentTable: GameTable | null;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  activeGame: boolean;
};

/** Append once per table. Existing history is immutable except payment status. */
export function archiveFinishedGameDay(
  archived: ArchivedGameDay[],
  state: GameDayState,
  completedAt: string | null = null,
): ArchivedGameDay[] {
  if (
    !state.currentTable ||
    state.activeGame ||
    archived.some(({ table }) => table.id === state.currentTable!.id)
  )
    return archived;
  const day: ArchivedGameDay = {
    table: { ...state.currentTable, isActive: false },
    players: state.players,
    rounds: state.rounds,
    balances: state.balances,
    settlements: state.settlements,
    completedAt,
  };
  // A closed evening must never retain mutable references to the next table.
  return [JSON.parse(JSON.stringify(day)) as ArchivedGameDay, ...archived];
}

/** Archives cannot disappear when restoring an older backup without this field. */
export function mergeGameDayArchives(
  local: ArchivedGameDay[],
  incoming: ArchivedGameDay[] = [],
) {
  const incomingIds = new Set(incoming.map(({ table }) => table.id));
  return [
    ...incoming,
    ...local.filter(({ table }) => !incomingIds.has(table.id)),
  ];
}
