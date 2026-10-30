import type { RealtimeChannel } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export type RealtimeTableEvent =
  | 'table_changed'
  | 'player_changed'
  | 'round_changed'
  | 'settlement_changed';

export type RealtimeTablePayload = {
  event: RealtimeTableEvent;
  payload: unknown;
};

export type TableRealtimeSubscription = {
  tableId: string;
  channel: RealtimeChannel | null;
  unsubscribe: () => void;
};

type SubscribeToTableOptions = {
  onEvent?: (event: RealtimeTablePayload) => void;
  onError?: (message: string) => void;
};

export function subscribeToTable(
  tableId: string,
  options: SubscribeToTableOptions = {},
): TableRealtimeSubscription {
  if (!isSupabaseConfigured) {
    return {
      tableId,
      channel: null,
      unsubscribe: () => undefined,
    };
  }

  const channel = supabase
    .channel(`game-table:${tableId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tables',
        filter: `id=eq.${tableId}`,
      },
      (payload) => options.onEvent?.({ event: 'table_changed', payload }),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `table_id=eq.${tableId}`,
      },
      (payload) => options.onEvent?.({ event: 'player_changed', payload }),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `table_id=eq.${tableId}`,
      },
      (payload) => options.onEvent?.({ event: 'round_changed', payload }),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'settlements',
        filter: `table_id=eq.${tableId}`,
      },
      (payload) => options.onEvent?.({ event: 'settlement_changed', payload }),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        options.onError?.(`Realtime channel status: ${status}`);
      }
    });

  return {
    tableId,
    channel,
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
