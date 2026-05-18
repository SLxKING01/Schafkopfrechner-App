import { isSupabaseConfigured } from '../../lib/supabase';
import type { GameRound } from '../../types/game';
import type { SyncResult } from './syncGameTable';

export async function syncRounds(rounds: GameRound[]): Promise<SyncResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: true,
      syncedAt: null,
      queued: rounds.length > 0,
      message:
        'Supabase nicht konfiguriert. Rounds Sync wurde lokal vorgemerkt.',
    };
  }

  // TODO: insert unsynced rounds and mark local events as acknowledged.
  return { ok: true, syncedAt: new Date().toISOString(), queued: false };
}
