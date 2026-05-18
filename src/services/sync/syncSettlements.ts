import { isSupabaseConfigured } from '../../lib/supabase';
import type { Settlement } from '../../types/game';
import type { SyncResult } from './syncGameTable';

export async function syncSettlements(
  settlements: Settlement[],
): Promise<SyncResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: true,
      syncedAt: null,
      queued: settlements.length > 0,
      message:
        'Supabase nicht konfiguriert. Settlement Sync wurde lokal vorgemerkt.',
    };
  }

  // TODO: upsert settlement payment states into Supabase.
  return { ok: true, syncedAt: new Date().toISOString(), queued: false };
}
