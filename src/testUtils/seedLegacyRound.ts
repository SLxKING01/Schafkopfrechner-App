import { createGameRound } from '../services/game/createRound';
import { finishGameDay } from '../services/game/finishGameDay';
import { useGameStore } from '../store/gameStore';
import type { CreateRoundPayload } from '../types/game';
import { calculateRoundBalances, isValidRound } from '../utils/accounting';
import { outstandingBalances } from '../utils/interimPayments';

/** Existing saved manual entries could have fewer than four participants.
 * Seed those historic fixtures directly; new entries must use the four-player store boundary. */
export function seedLegacyRound(payload: CreateRoundPayload) {
  const state = useGameStore.getState();
  if (
    payload.stockAction ||
    (payload.winnerIds ?? [payload.winnerId]).length +
      payload.loserIds.length ===
      4
  )
    return state.addRound(payload);
  if (!state.currentTable || !isValidRound(payload, state.players))
    return false;
  const round = createGameRound(state.currentTable.id, {
    ...payload,
    settingsSnapshot: state.currentTable.settings,
  });
  const rounds = [...state.rounds, round];
  const balances = calculateRoundBalances(state.players, rounds, 'id');
  useGameStore.setState({
    rounds,
    balances,
    settlements: finishGameDay(
      outstandingBalances(balances, state.currentTable.interimPayments),
    ),
  });
  return true;
}
