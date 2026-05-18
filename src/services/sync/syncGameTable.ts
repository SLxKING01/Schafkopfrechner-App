import { isSupabaseConfigured } from '../../lib/supabase';
import type { GameTable, Player } from '../../types/game';

export type SyncResult = {
  ok: boolean;
  syncedAt: string | null;
  queued: boolean;
  message?: string;
};

export async function syncGameTable(
  table: GameTable | null,
  players: Player[],
): Promise<SyncResult> {
  if (!table) {
    return { ok: true, syncedAt: null, queued: false };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: true,
      syncedAt: null,
      queued: true,
      message:
        'Supabase nicht konfiguriert. Table Sync wurde lokal vorgemerkt.',
    };
  }

  void players;
  // TODO: upsert table and players into Supabase inside one logical sync batch.
  return { ok: true, syncedAt: new Date().toISOString(), queued: false };
}
