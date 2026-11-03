import type {
  GameRound,
  GameTable,
  Player,
  RoundHistoryEvent,
  RoundTurnState,
} from '../types/game';
import { getCurrentDealerId } from './dealerOrder';

type RoundState = {
  currentTable: GameTable | null;
  players: Player[];
  rounds: GameRound[];
};

export function captureRoundTurn(state: RoundState): RoundTurnState {
  const dealerId =
    getCurrentDealerId(
      state.currentTable,
      state.players,
      state.rounds.length,
    ) ?? undefined;
  const legerPlayerIds = [...(state.currentTable?.placedLegerPlayerIds ?? [])];
  const turboRamsch = state.currentTable?.turboRamschEnabled ?? false;
  return {
    dealerId,
    legerPlayerIds,
    turboRamsch,
    signature: JSON.stringify([
      state.currentTable?.roundHistory
        ?.slice()
        .reverse()
        .find((event) => !event.causeRoundId && event.action !== 'updated')?.id,
      state.rounds.length,
      state.rounds.at(-1)?.id,
      state.players.map((p) => [p.id, !!p.isPaused]),
      dealerId,
      [...legerPlayerIds].sort(),
      turboRamsch,
    ]),
  };
}

/** Record only newly generated events, never mutate an accepted audit event. */
export function withRoundUndoContext<T extends RoundState>(
  state: T,
  patch: Partial<T>,
): Partial<T> {
  const next = { ...state, ...patch };
  if (
    !state.currentTable ||
    !next.currentTable ||
    state.currentTable.id !== next.currentTable.id
  )
    return patch;
  const known = new Set(
    state.currentTable.roundHistory?.map((event) => event.id),
  );
  const turnBefore = captureRoundTurn(state);
  const turnAfter = captureRoundTurn(next);
  return {
    ...patch,
    currentTable: {
      ...next.currentTable,
      roundHistory: next.currentTable.roundHistory?.map((event) =>
        known.has(event.id) || event.causeRoundId
          ? event
          : { ...event, turnBefore, turnAfter },
      ),
    },
  };
}

/** A later round, manual dealer choice, pause, reorder or new Leger wins. */
export function rewindUnchangedTurn(
  state: RoundState,
  event?: RoundHistoryEvent,
): Partial<GameTable> {
  if (
    !event?.turnBefore ||
    !event.turnAfter ||
    captureRoundTurn(state).signature !== event.turnAfter.signature
  )
    return {};
  return {
    ...(event.turnBefore.dealerId !== event.turnAfter.dealerId
      ? { dealerId: event.turnBefore.dealerId }
      : {}),
    ...(JSON.stringify(event.turnBefore.legerPlayerIds) !==
    JSON.stringify(event.turnAfter.legerPlayerIds)
      ? { placedLegerPlayerIds: [...event.turnBefore.legerPlayerIds] }
      : {}),
    ...(event.turnBefore.turboRamsch !== event.turnAfter.turboRamsch
      ? { turboRamschEnabled: event.turnBefore.turboRamsch }
      : {}),
  };
}
