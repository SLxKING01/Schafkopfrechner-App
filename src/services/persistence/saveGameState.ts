import {
  type PersistedGameState,
  savePersistedGameState,
} from '../../storage/gameStorage';

export async function saveGameState(state: PersistedGameState) {
  await savePersistedGameState(state);
}
