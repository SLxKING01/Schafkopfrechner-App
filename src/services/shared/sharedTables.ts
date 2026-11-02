import { create } from 'zustand';

import { supabase } from '../../lib/supabase';
import { reliableStorage } from '../../storage/reliableStorage';
import { validGameSnapshot } from '../../storage/validateGameState';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import type {
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../../types/game';
import { archiveFinishedGameDay } from '../../utils/gameDayArchive';
import { fingerprint } from '../sync/syncGameState';
import { mergeSharedRounds, rebaseInFlightRounds } from './mergeSharedRounds';

export type SharedSnapshot = {
  currentTable: GameTable;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  activeGame: boolean;
};
export type SharedTableRemote = {
  id: string;
  payload: SharedSnapshot;
  code?: string;
  ownerId?: string;
  version: number;
  updatedAt: string;
};
type Remote = SharedTableRemote;
type Conflict = { userId: string; tableId: string; remote: Remote };
export const useSharedTableStatus = create<{
  tables: Remote[];
  tablesUserId: string | null;
  busy: boolean;
  error: string | null;
  conflict: Conflict | null;
}>(() => ({
  tables: [],
  tablesUserId: null,
  busy: false,
  error: null,
  conflict: null,
}));

function localTable(id: string) {
  const state = useGameStore.getState();
  return state.currentTable?.id === id
    ? state.currentTable
    : state.archivedGameDays.find((day) => day.table.id === id)?.table;
}
export function sharedSnapshot(tableId?: string): SharedSnapshot | null {
  const state = useGameStore.getState();
  const archive =
    tableId && state.currentTable?.id !== tableId
      ? state.archivedGameDays.find((day) => day.table.id === tableId)
      : undefined;
  const currentTable = archive ? archive.table : state.currentTable;
  if (!currentTable || (tableId && currentTable.id !== tableId)) return null;
  const { shared: _binding, ...table } = currentTable;
  return {
    currentTable: table,
    players: archive?.players ?? state.players,
    rounds: archive?.rounds ?? state.rounds,
    balances: archive?.balances ?? state.balances,
    settlements: archive?.settlements ?? state.settlements,
    activeGame: archive ? false : state.activeGame,
  };
}
function isPresent(id: string, actor: string) {
  return (
    useAuthStore.getState().user?.id === actor &&
    localTable(id)?.shared?.userId === actor
  );
}
function userId() {
  const id = useAuthStore.getState().user?.id;
  if (!id) throw new Error('Bitte zuerst anmelden.');
  return id;
}
function assertSnapshot(snapshot: unknown): asserts snapshot is SharedSnapshot {
  if (
    !validGameSnapshot(snapshot) ||
    !(snapshot as SharedSnapshot)?.currentTable
  )
    throw new Error(
      'Der Tischstand ist ungültig. Lokale Daten bleiben erhalten.',
    );
}
async function command(
  action: string,
  params: Record<string, unknown> = {},
): Promise<Remote> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await supabase
      .rpc('sk_live_command', { p_action: action, ...params })
      .abortSignal(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
  const { data, error } = response;
  if (error)
    throw Object.assign(new Error(error.message), { code: error.code });
  assertSnapshot(data?.payload);
  if (
    data.id !== data.payload.currentTable.id ||
    !Number.isSafeInteger(data.version) ||
    data.version < 1
  )
    throw new Error('Ungültige Antwort vom Tischserver.');
  return data as Remote;
}
function isCurrent(id: string, actor: string) {
  return (
    useAuthStore.getState().user?.id === actor &&
    useGameStore.getState().currentTable?.id === id
  );
}
function binding(remote: Remote, actor: string) {
  return {
    userId: actor,
    code: remote.code,
    ownerId: remote.ownerId,
    version: remote.version,
    baseline: fingerprint(remote.payload),
    updatedAt: remote.updatedAt,
  };
}
function setBinding(remote: Remote, actor: string) {
  useGameStore.setState((state) => ({
    currentTable:
      state.currentTable?.id === remote.id
        ? { ...state.currentTable, shared: binding(remote, actor) }
        : state.currentTable,
    archivedGameDays: state.archivedGameDays.map((day) =>
      day.table.id === remote.id
        ? { ...day, table: { ...day.table, shared: binding(remote, actor) } }
        : day,
    ),
  }));
}
function apply(remote: Remote, actor: string, joining = false) {
  const state = useGameStore.getState();
  const snapshot = {
    ...remote.payload,
    currentTable: {
      ...remote.payload.currentTable,
      shared: binding(remote, actor),
    },
  };
  let archived = state.archivedGameDays.map((day) =>
    day.table.id === remote.id
      ? {
          ...day,
          table: snapshot.currentTable,
          players: remote.payload.players,
          rounds: remote.payload.rounds,
          balances: remote.payload.balances,
          settlements: remote.payload.settlements,
        }
      : day,
  );
  if (!snapshot.activeGame)
    archived = archiveFinishedGameDay(archived, snapshot);
  useGameStore.setState({
    ...(joining || state.currentTable?.id === remote.id ? snapshot : {}),
    archivedGameDays: archived,
  });
}
export async function publishSharedTable() {
  if (running) await running;
  return publishSharedTableInternal();
}
async function publishSharedTableInternal() {
  const actor = userId();
  const local = sharedSnapshot();
  if (!local) throw new Error('Bitte zuerst einen Tisch erstellen.');
  if (useGameStore.getState().currentTable?.shared)
    throw new Error('Dieser Tisch ist bereits freigegeben.');
  assertSnapshot(local);
  let remote: Remote;
  try {
    remote = await command('create', {
      p_table_id: local.currentTable.id,
      p_payload: local,
      p_version: 0,
    });
  } catch (error) {
    // A timed-out create may already have committed. Recover only an identical snapshot.
    const existing = await command('read', {
      p_table_id: local.currentTable.id,
    }).catch(() => null);
    if (!existing || fingerprint(existing.payload) !== fingerprint(local))
      throw error;
    remote = existing;
  }
  if (!isCurrent(remote.id, actor)) return;
  // Keep edits made while the first upload was in progress; the next sync sends them.
  useGameStore.setState((state) => ({
    currentTable: { ...state.currentTable!, shared: binding(remote, actor) },
  }));
  useSharedTableStatus.setState({ error: null, conflict: null });
  return remote.code;
}
export async function openSharedTable(tableId: string) {
  await syncSharedTable();
  const actor = userId();
  const state = useGameStore.getState();
  if (
    state.currentTable?.id === tableId &&
    state.currentTable.shared?.userId === actor
  )
    return;
  if (
    state.currentTable &&
    state.activeGame &&
    (!state.currentTable.shared ||
      fingerprint(sharedSnapshot()) !== state.currentTable.shared.baseline)
  )
    throw new Error(
      'Der aktuelle Tisch hat noch nicht übertragene Änderungen. Bitte zuerst synchronisieren oder den lokalen Tisch abschließen.',
    );
  const before = fingerprint(sharedSnapshot());
  const remote = await command('read', { p_table_id: tableId });
  if (
    useAuthStore.getState().user?.id !== actor ||
    fingerprint(sharedSnapshot()) !== before
  )
    throw new Error('Konto oder Tisch hat sich geändert. Bitte erneut öffnen.');
  const backupKey = `shared-before-open:${actor}:${Date.now()}`;
  await reliableStorage.setItem(backupKey, JSON.stringify(sharedSnapshot()));
  if (!(await reliableStorage.confirmWrite(backupKey)))
    throw new Error('Lokale Sicherung fehlgeschlagen.');
  if (
    useAuthStore.getState().user?.id !== actor ||
    fingerprint(sharedSnapshot()) !== before
  )
    throw new Error('Tisch inzwischen geändert. Bitte erneut öffnen.');
  apply(remote, actor, true);
  useSharedTableStatus.setState({ error: null, conflict: null });
}
let refreshing: Promise<void> | null = null;
export function refreshSharedTables(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = discoverSharedTables().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
async function hideForeignSharedCache(actor: string) {
  const state = useGameStore.getState();
  const foreignCurrent =
    state.currentTable?.shared && state.currentTable.shared.userId !== actor;
  const foreignArchives = state.archivedGameDays.filter(
    (day) => day.table.shared && day.table.shared.userId !== actor,
  );
  if (!foreignCurrent && !foreignArchives.length) return;
  const key = `shared-account-cache:${state.currentTable?.shared?.userId ?? 'previous'}:${Date.now()}`;
  await reliableStorage.setItem(
    key,
    JSON.stringify({
      current: foreignCurrent ? state : null,
      archived: foreignArchives,
    }),
  );
  if (!(await reliableStorage.confirmWrite(key)))
    throw new Error('Lokale Kontosicherung fehlgeschlagen.');
  if (
    useAuthStore.getState().user?.id !== actor ||
    useGameStore.getState().currentTable !== state.currentTable ||
    useGameStore.getState().archivedGameDays !== state.archivedGameDays
  )
    return;
  useGameStore.setState((latest) => ({
    ...(foreignCurrent
      ? {
          currentTable: null,
          players: [],
          rounds: [],
          balances: [],
          settlements: [],
          activeGame: false,
        }
      : {}),
    archivedGameDays: latest.archivedGameDays.filter(
      (day) =>
        !foreignArchives.some((foreign) => foreign.table.id === day.table.id),
    ),
  }));
}
async function discoverSharedTables() {
  const actor = useAuthStore.getState().user?.id;
  if (!actor) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    await hideForeignSharedCache(actor);
    if (useAuthStore.getState().user?.id !== actor) return;
    const observedState = useGameStore.getState();
    const observedBinding = observedState.currentTable?.shared;
    const { data, error } = await supabase
      .from('sk_live_tables')
      .select('id,payload,version,updated_at,owner_id')
      .order('updated_at', { ascending: false })
      .abortSignal(controller.signal);
    if (error) throw error;
    if (useAuthStore.getState().user?.id !== actor) return;
    const tables: Remote[] = (data ?? []).map((row) => {
      assertSnapshot(row.payload);
      return {
        id: row.id,
        payload: row.payload,
        version: row.version,
        updatedAt: row.updated_at,
        ownerId: row.owner_id,
      };
    });
    useSharedTableStatus.setState({ tables, tablesUserId: actor });
    const state = useGameStore.getState();
    const table = state.currentTable;
    const missing =
      table?.shared &&
      table.shared === observedBinding &&
      (table.shared.userId !== actor ||
        !tables.some((candidate) => candidate.id === table.id));
    const hiddenArchives = state.archivedGameDays.filter(
      (day) =>
        day.table.shared &&
        observedState.archivedGameDays.some(
          (observed) =>
            observed.table.id === day.table.id &&
            observed.table.shared === day.table.shared,
        ) &&
        (day.table.shared.userId !== actor ||
          !tables.some((candidate) => candidate.id === day.table.id)),
    );
    if (missing || hiddenArchives.length) {
      const key = `shared-removed-access:${table?.shared?.userId ?? actor}:${Date.now()}`;
      await reliableStorage.setItem(
        key,
        JSON.stringify({
          current: missing ? state : null,
          archived: hiddenArchives,
        }),
      );
      if (!(await reliableStorage.confirmWrite(key)))
        throw new Error('Lokale Sicherung fehlgeschlagen.');
      if (
        useAuthStore.getState().user?.id !== actor ||
        (missing && useGameStore.getState().currentTable !== table) ||
        useGameStore.getState().archivedGameDays !== state.archivedGameDays
      )
        return;
      useGameStore.setState((latest) => ({
        ...(missing
          ? {
              currentTable: null,
              players: [],
              rounds: [],
              balances: [],
              settlements: [],
              activeGame: false,
            }
          : {}),
        archivedGameDays: latest.archivedGameDays.filter(
          (day) =>
            !hiddenArchives.some((hidden) => hidden.table.id === day.table.id),
        ),
      }));
    }
  } catch (reason) {
    if (useAuthStore.getState().user?.id === actor)
      useSharedTableStatus.setState({
        error:
          reason instanceof Error
            ? reason.message
            : 'Gemeinsame Tische konnten nicht geladen werden.',
      });
  } finally {
    clearTimeout(timeout);
  }
}
let running: Promise<void> | null = null;
export function syncSharedTable(): Promise<void> {
  if (running) return running;
  running = (async () => {
    let state = useGameStore.getState();
    const actor = useAuthStore.getState().user?.id;
    if (
      actor &&
      state.currentTable &&
      !state.currentTable.shared &&
      state.activeGame &&
      state.players.some((player) => player.userId === actor)
    ) {
      try {
        await publishSharedTableInternal();
      } catch (error) {
        useSharedTableStatus.setState({
          error:
            error instanceof Error
              ? error.message
              : 'Tisch noch nicht übertragen.',
        });
      }
      state = useGameStore.getState();
    }
    const ids = new Set([
      state.currentTable?.id,
      ...state.archivedGameDays.map((day) => day.table.id),
    ]);
    for (const id of ids) if (id) await synchronize(id);
  })().finally(() => {
    running = null;
  });
  return running;
}
async function synchronize(tableId: string) {
  const table = localTable(tableId);
  const meta = table?.shared;
  const actor = useAuthStore.getState().user?.id;
  if (!table || !meta || !actor || actor !== meta.userId) return;
  if (useSharedTableStatus.getState().conflict?.tableId === table.id) return;
  useSharedTableStatus.setState({ busy: true });
  try {
    let remote = await command('read', { p_table_id: table.id });
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!isPresent(table.id, actor)) return;
      const currentMeta = localTable(table.id)?.shared;
      if (!currentMeta || currentMeta.userId !== actor) return;
      const local = sharedSnapshot(table.id)!;
      assertSnapshot(local);
      const localKey = fingerprint(local);
      const remoteKey = fingerprint(remote.payload);
      if (localKey === remoteKey || localKey === currentMeta.baseline) {
        apply(remote, actor);
        break;
      }
      let candidate = local;
      if (remote.version !== currentMeta.version) {
        let merged: SharedSnapshot | null = null;
        try {
          merged = mergeSharedRounds(
            JSON.parse(currentMeta.baseline),
            local,
            remote.payload,
          );
        } catch {
          /* Older or invalid baseline: keep both versions for review. */
        }
        if (merged) candidate = merged;
        else {
          useSharedTableStatus.setState({
            conflict: { userId: actor, tableId: table.id, remote },
            error:
              'Der Tisch oder ein Spiel wurde inzwischen auf einem anderen Handy geändert. Deine Eingaben bleiben erhalten. Lade den aktuellen Stand, prüfe die Änderung und bearbeite das Spiel erneut.',
          });
          return;
        }
      }
      try {
        const saved =
          fingerprint(candidate) === remoteKey
            ? remote
            : await command('save', {
                p_table_id: table.id,
                p_version: remote.version,
                p_payload: candidate,
              });
        if (!isPresent(table.id, actor)) return;
        const latest = sharedSnapshot(table.id)!;
        if (fingerprint(latest) === localKey) apply(saved, actor);
        else if (fingerprint(candidate) === localKey) setBinding(saved, actor);
        else {
          const rebased = rebaseInFlightRounds(local, latest, saved.payload);
          if (rebased) apply({ ...saved, payload: rebased }, actor);
          // Keep the actual accepted baseline, including unsent edits made in flight.
          setBinding(saved, actor);
          if (!rebased)
            useSharedTableStatus.setState({
              conflict: { userId: actor, tableId: table.id, remote: saved },
              error:
                'Während des Abgleichs wurde der Tisch bearbeitet. Deine Änderungen bleiben lokal erhalten. Bitte den aktuellen Stand prüfen.',
            });
        }
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== '40001') throw error;
        // A writer won the compare-and-swap after our read. Re-read and rebase,
        // never retry the old whole-table snapshot against a newer version.
        if (attempt === 2)
          throw new Error(
            'Der Tisch wird gerade auf einem anderen Handy geändert. Deine Eingaben bleiben erhalten. Bitte erneut synchronisieren.',
          );
        remote = await command('read', { p_table_id: table.id });
      }
    }
    if (!useSharedTableStatus.getState().conflict)
      useSharedTableStatus.setState({ error: null });
  } catch (error) {
    if (isPresent(table.id, actor))
      useSharedTableStatus.setState({
        error:
          error instanceof Error
            ? error.message
            : 'Tisch konnte nicht abgeglichen werden.',
      });
  } finally {
    useSharedTableStatus.setState({ busy: false });
  }
}
export async function loadSharedTableAfterConflict() {
  if (running) await running;
  const conflict = useSharedTableStatus.getState().conflict;
  if (!conflict || !isPresent(conflict.tableId, conflict.userId)) return;
  const before = sharedSnapshot(conflict.tableId);
  const key = `shared-conflict-backup:${conflict.userId}:${conflict.tableId}:${Date.now()}`;
  await reliableStorage.setItem(key, JSON.stringify(before));
  if (!(await reliableStorage.confirmWrite(key)))
    throw new Error(
      'Lokale Sicherung fehlgeschlagen. Änderungen bleiben erhalten.',
    );
  const remote = await command('read', { p_table_id: conflict.tableId });
  if (
    !isPresent(conflict.tableId, conflict.userId) ||
    fingerprint(sharedSnapshot(conflict.tableId)) !== fingerprint(before)
  )
    throw new Error(
      'Der lokale Stand wurde inzwischen geändert. Bitte erneut laden.',
    );
  apply(remote, conflict.userId);
  useSharedTableStatus.setState({ conflict: null, error: null });
}
