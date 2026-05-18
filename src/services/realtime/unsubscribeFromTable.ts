import type { TableRealtimeSubscription } from './subscribeToTable';

export function unsubscribeFromTable(subscription?: TableRealtimeSubscription) {
  subscription?.unsubscribe();
}
