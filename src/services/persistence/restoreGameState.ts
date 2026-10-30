import { restorePersistedGameState } from '../../storage/gameStorage';

export async function restoreGameState() {
  return restorePersistedGameState();
}
