import { clearPersistedGameState } from '../../storage/gameStorage';

export async function clearGameState() {
  await clearPersistedGameState();
}
