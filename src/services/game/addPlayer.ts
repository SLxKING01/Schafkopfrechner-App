import * as crypto from 'expo-crypto';

import type { Player } from '../../types/game';

export function createLocalPlayer(name: string): Player {
  // TODO: resolve logged-in friends from Supabase profiles later.
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    isLocal: true,
  };
}
