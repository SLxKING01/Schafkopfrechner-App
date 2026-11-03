import { create } from 'zustand';

import {
  executeFriendCommand,
  FriendError,
  readFriends,
} from '../services/friends/friends';
import { readFriendOperation } from '../services/friends/friendStorage';
import type { FriendCommand, FriendsState } from '../types/friends';
import { useAuthStore } from './authStore';

type FriendsCache = {
  ownerId: string | null;
  state: FriendsState | null;
  loading: boolean;
  busy: boolean;
  pending: FriendCommand | null;
  storageBlocked: boolean;
  error: string | null;
};
const empty = (): FriendsCache => ({
  ownerId: null,
  state: null,
  loading: false,
  busy: false,
  pending: null,
  storageBlocked: false,
  error: null,
});
export const useFriendsStore = create<FriendsCache>(() => empty());
export function resetFriendsSession(actor?: string) {
  if (useFriendsStore.getState().ownerId !== (actor ?? null))
    useFriendsStore.setState({ ...empty(), ownerId: actor ?? null });
}
function active(actor: string) {
  return useAuthStore.getState().user?.id === actor;
}
function accept(state: FriendsState) {
  const current = useFriendsStore.getState();
  if (
    active(state.userId) &&
    current.ownerId === state.userId &&
    (!current.state || state.version >= current.state.version)
  )
    useFriendsStore.setState({ state });
}
const reads = new Map<string, Promise<void>>();
export function refreshFriends(actor: string): Promise<void> {
  if (!active(actor)) return Promise.resolve();
  if (
    useFriendsStore.getState().ownerId === actor &&
    useFriendsStore.getState().busy
  )
    return Promise.resolve();
  const previous = reads.get(actor);
  if (previous) return previous;
  resetFriendsSession(actor);
  useFriendsStore.setState({ loading: true });
  const task = (async () => {
    const [operation, state] = await Promise.allSettled([
      readFriendOperation(actor),
      readFriends(actor),
    ]);
    if (!active(actor)) return;
    const pending =
      operation.status === 'fulfilled'
        ? operation.value
        : useFriendsStore.getState().pending;
    if (state.status === 'fulfilled') accept(state.value);
    useFriendsStore.setState({
      pending,
      storageBlocked: operation.status === 'rejected',
      error:
        operation.status === 'rejected'
          ? 'Der gespeicherte Kontaktauftrag konnte nicht geladen werden. Bitte erneut laden; weitere Änderungen bleiben bis dahin gesperrt.'
          : state.status === 'rejected'
            ? `Freunde konnten nicht aktualisiert werden. ${state.reason instanceof Error ? state.reason.message : 'Bitte erneut versuchen.'}`
            : null,
    });
  })().finally(() => {
    if (reads.get(actor) === task) reads.delete(actor);
    if (active(actor)) useFriendsStore.setState({ loading: false });
  });
  reads.set(actor, task);
  return task;
}
export async function runFriendCommand(
  actor: string,
  command: FriendCommand,
): Promise<{ success: boolean; code?: string }> {
  if (
    !active(actor) ||
    useFriendsStore.getState().busy ||
    useFriendsStore.getState().loading
  )
    return { success: false, code: 'BUSY' };
  resetFriendsSession(actor);
  useFriendsStore.setState({ busy: true, pending: command, error: null });
  try {
    const state = await executeFriendCommand(actor, command);
    if (!active(actor)) return { success: false, code: 'ACCOUNT_CHANGED' };
    accept(state);
    useFriendsStore.setState({
      pending: null,
      storageBlocked: false,
      error: null,
    });
    return { success: true };
  } catch (reason) {
    if (!active(actor)) return { success: false, code: 'ACCOUNT_CHANGED' };
    const error =
      reason instanceof FriendError
        ? reason
        : new FriendError(
            reason instanceof Error
              ? reason.message
              : 'Kontaktauftrag fehlgeschlagen.',
            'LOCAL_STORAGE',
          );
    if (error.state) accept(error.state);
    try {
      const pending = error.pending ?? (await readFriendOperation(actor));
      if (active(actor))
        useFriendsStore.setState({
          pending,
          storageBlocked: false,
          error: `${error.message}${pending ? ' Bitte den gespeicherten Auftrag erneut prüfen. Deine Auswahl bleibt erhalten.' : ''}`,
        });
    } catch {
      if (active(actor))
        useFriendsStore.setState({
          storageBlocked: true,
          error:
            'Der Kontaktauftrag konnte nicht gelesen werden. Bitte erneut laden.',
        });
    }
    return { success: false, code: error.code };
  } finally {
    if (active(actor)) useFriendsStore.setState({ busy: false });
  }
}
