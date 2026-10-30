import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Game } from '../../models/Game';
import type { MatchDay } from '../../models/MatchDay';
import type { Player as SavedPlayer } from '../../models/Player';
import {
  getStorageIssues,
  reliableStorage,
} from '../../storage/reliableStorage';
import {
  normalizeRestoredTables,
  validCloudSnapshot,
} from '../../storage/validateGameState';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useMatchDayStore } from '../../store/matchDayStore';
import { usePlayerStore } from '../../store/playerStore';
import type {
  ArchivedGameDay,
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../../types/game';
import {
  archiveFinishedGameDay,
  mergeGameDayArchives,
} from '../../utils/gameDayArchive';

export type CloudGameState = {
  schemaVersion: 1;
  archivedGameDays?: ArchivedGameDay[];
  currentTable: GameTable | null;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  activeGame: boolean;
  tableOrderIds: string[];
  games: Game[];
  savedPlayers: SavedPlayer[];
  matchDays: MatchDay[];
  activeMatchDayId: string | null;
};

export function captureGameState(): CloudGameState {
  const game = useGameStore.getState();
  const days = useMatchDayStore.getState();
  return {
    schemaVersion: 1,
    archivedGameDays: game.archivedGameDays,
    currentTable: game.currentTable,
    players: game.players,
    rounds: game.rounds,
    balances: game.balances,
    settlements: game.settlements,
    activeGame: game.activeGame,
    tableOrderIds: game.tableOrderIds,
    games: game.games,
    savedPlayers: usePlayerStore.getState().players,
    matchDays: days.matchDays,
    activeMatchDayId: days.activeMatchDayId,
  };
}

// Canonical JSON also compares snapshots returned by Postgres JSONB (key order differs).
export function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(fingerprint).join(',') + ']';
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + fingerprint(v))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

function hasLocalData(state: CloudGameState) {
  return Boolean(
    state.archivedGameDays?.length ||
    state.currentTable ||
    state.games.length ||
    state.savedPlayers.length ||
    state.players.length ||
    state.rounds.length ||
    state.settlements.length ||
    state.matchDays.length > 1 ||
    state.matchDays.some((day) => day.name !== 'Heute' || day.isClosed),
  );
}

function validateSnapshot(value: unknown): asserts value is CloudGameState {
  if (!validCloudSnapshot(value)) {
    throw new Error(
      'Die Cloud-Sicherung hat ein unbekanntes Format. Lokale Daten bleiben erhalten.',
    );
  }
}

export let applyingCloudState = false;
function applySnapshot(snapshot: CloudGameState) {
  validateSnapshot(snapshot);
  snapshot = normalizeRestoredTables(snapshot);
  applyingCloudState = true;
  try {
    usePlayerStore.setState({ players: snapshot.savedPlayers });
    useMatchDayStore.setState({
      matchDays: snapshot.matchDays,
      activeMatchDayId: snapshot.activeMatchDayId,
    });
    useGameStore.setState({
      archivedGameDays: archiveFinishedGameDay(
        mergeGameDayArchives(
          useGameStore.getState().archivedGameDays,
          snapshot.archivedGameDays ?? [],
        ),
        snapshot,
      ),
      currentTable: snapshot.currentTable,
      players: snapshot.players,
      rounds: snapshot.rounds,
      balances: snapshot.balances,
      settlements: snapshot.settlements,
      activeGame: snapshot.activeGame,
      tableOrderIds: snapshot.tableOrderIds,
      games: snapshot.games,
    });
  } finally {
    applyingCloudState = false;
  }
}

type RestoreJournal = {
  schemaVersion: 1;
  ownerId: string;
  phase: 'pending' | 'complete';
  before: CloudGameState;
  after: CloudGameState;
  remoteVersion: number;
  remoteBaseline: string;
  updatedAt: string;
};
const RESTORE_KEY = 'schafkopfrechner-sync-restore';
async function persistConfirmed(key: string, value: unknown) {
  await reliableStorage.setItem(key, JSON.stringify(value));
  if (!(await reliableStorage.confirmWrite(key)))
    throw new Error(
      'Sicherung auf dem Gerät fehlgeschlagen. Keine Cloud-Fassung wird übernommen.',
    );
}
async function finishRestore(journal: RestoreJournal) {
  applySnapshot(journal.after);
  useGameStore.setState({
    cloudOwnerId: journal.ownerId,
    cloudVersion: journal.remoteVersion,
    cloudBaseline: journal.remoteBaseline,
    lastSyncedAt: journal.updatedAt,
  });
  await reliableStorage.flush();
  for (const key of [
    'schafkopfrechner-games',
    'schafkopfrechner-players',
    'schafkopfrechner-match-days',
  ]) {
    if (!(await reliableStorage.confirmWrite(key)))
      throw new Error(
        'Wiederherstellung noch nicht vollständig gespeichert. Beide Fassungen sind gesichert; die Wiederherstellung wird beim nächsten Start fortgesetzt.',
      );
  }
  await persistConfirmed(RESTORE_KEY, { ...journal, phase: 'complete' });
}
async function restoreSnapshot(
  snapshot: CloudGameState,
  ownerId: string,
  version: number,
  updatedAt: string,
) {
  validateSnapshot(snapshot);
  const before = captureGameState();
  const journal: RestoreJournal = {
    schemaVersion: 1,
    ownerId,
    phase: 'pending',
    before,
    after: {
      ...snapshot,
      archivedGameDays: archiveFinishedGameDay(
        mergeGameDayArchives(
          before.archivedGameDays ?? [],
          snapshot.archivedGameDays ?? [],
        ),
        snapshot,
      ),
    },
    remoteVersion: version,
    remoteBaseline: fingerprint(snapshot),
    updatedAt,
  };
  await persistConfirmed(RESTORE_KEY, journal);
  if (fingerprint(captureGameState()) !== fingerprint(before)) {
    await persistConfirmed(RESTORE_KEY, { ...journal, phase: 'complete' });
    throw new Error(
      'Lokale Daten wurden während der Sicherung geändert. Keine Cloud-Daten übernommen; bitte erneut vergleichen.',
    );
  }
  if (useAuthStore.getState().user?.id !== ownerId) {
    await persistConfirmed(RESTORE_KEY, {
      ...journal,
      phase: 'complete',
      after: before,
    });
    throw new Error(
      'Das Konto hat sich geändert. Es wurden keine Cloud-Daten übernommen.',
    );
  }
  await finishRestore(journal);
}
/** Startup repair runs before screens are released, so separate stores cannot stay half restored. */
let recovering: Promise<void> | null = null;
export function recoverPendingSyncRestore() {
  if (!recovering)
    recovering = resumePendingSyncRestore().finally(() => {
      recovering = null;
    });
  return recovering;
}
async function resumePendingSyncRestore() {
  const raw = await reliableStorage.getItem(RESTORE_KEY);
  if (!raw) return;
  const journal = JSON.parse(raw) as RestoreJournal;
  if (journal.phase === 'pending') {
    const current = captureGameState();
    const groups = [
      (state: CloudGameState) => state.savedPlayers,
      (state: CloudGameState) => [state.matchDays, state.activeMatchDayId],
      (state: CloudGameState) => [
        state.currentTable,
        state.rounds,
        state.players,
        state.balances,
        state.settlements,
        state.activeGame,
        state.games,
        state.archivedGameDays ?? [],
      ],
    ];
    if (
      validCloudSnapshot(current) &&
      groups.some(
        (group) =>
          fingerprint(group(current)) !== fingerprint(group(journal.before)) &&
          fingerprint(group(current)) !== fingerprint(group(journal.after)),
      )
    ) {
      // A newer valid local edit must not be replaced by an old recovery marker.
      await persistConfirmed(RESTORE_KEY, { ...journal, phase: 'complete' });
      useGameStore.setState({
        cloudOwnerId: journal.ownerId,
        cloudVersion: null,
        cloudBaseline: null,
        syncError:
          'Unterbrochene Wiederherstellung: Neuere lokale Änderungen wurden behalten. Bitte die Cloud-Fassungen vergleichen.',
        isOffline: true,
      });
    } else await finishRestore(journal);
  }
}

export type SyncConflict = {
  ownerId: string;
  local: CloudGameState;
  remote: CloudGameState;
  remoteVersion: number;
  updatedAt: string;
};
let conflict: SyncConflict | null = null;
const conflictListeners = new Set<() => void>();
export const getSyncConflict = () => conflict;
export const subscribeSyncConflict = (listener: () => void) => {
  conflictListeners.add(listener);
  return () => {
    conflictListeners.delete(listener);
  };
};
function setConflict(next: SyncConflict | null) {
  conflict = next;
  conflictListeners.forEach((listener) => listener());
}
let resolving: Promise<void> | null = null;
export function resolveSyncConflict(
  choice: 'local' | 'remote',
  expected: SyncConflict,
) {
  if (resolving) return resolving;
  resolving = resolveConflict(choice, expected).finally(() => {
    resolving = null;
  });
  return resolving;
}
async function resolveConflict(
  choice: 'local' | 'remote',
  expected: SyncConflict,
) {
  if (running) await running;
  const owner = useAuthStore.getState().user?.id;
  if (!owner || owner !== expected.ownerId)
    throw new Error('Bitte mit dem Konto der Sicherung anmelden.');
  const { data: remote, error } = await supabase
    .from('game_states')
    .select('payload, version, updated_at')
    .eq('owner_id', owner)
    .maybeSingle();
  if (error) throw error;
  if (!remote)
    throw new Error(
      'Cloud-Fassung nicht mehr vorhanden. Bitte erneut synchronisieren.',
    );
  validateSnapshot(remote.payload);
  const local = captureGameState();
  validateSnapshot(local);
  if (useAuthStore.getState().user?.id !== owner)
    throw new Error('Das Konto hat sich geändert.');
  if (
    remote.version !== expected.remoteVersion ||
    fingerprint(local) !== fingerprint(expected.local) ||
    fingerprint(remote.payload) !== fingerprint(expected.remote)
  ) {
    setConflict({
      ownerId: owner,
      local,
      remote: remote.payload,
      remoteVersion: remote.version,
      updatedAt: remote.updated_at,
    });
    throw new Error(
      'Die Daten haben sich geändert. Bitte die aktualisierten Fassungen erneut vergleichen.',
    );
  }
  await persistConfirmed('schafkopfrechner-sync-conflict-backup', {
    schemaVersion: 1,
    ownerId: owner,
    savedAt: new Date().toISOString(),
    local,
    remote: remote.payload,
    remoteVersion: remote.version,
  });
  if (
    useAuthStore.getState().user?.id !== owner ||
    fingerprint(captureGameState()) !== fingerprint(local)
  )
    throw new Error(
      'Konto oder lokale Daten geändert. Bitte erneut vergleichen.',
    );
  if (choice === 'remote')
    await restoreSnapshot(
      remote.payload,
      owner,
      remote.version,
      remote.updated_at,
    );
  else {
    const { data, error: writeError } = await supabase.rpc('save_game_state', {
      p_payload: local,
      p_expected_version: remote.version,
    });
    if (writeError) throw writeError;
    if (!data?.[0])
      throw new Error('Die Cloud hat die Übernahme nicht bestätigt.');
    if (useAuthStore.getState().user?.id !== owner) return;
    useGameStore.setState({
      cloudOwnerId: owner,
      cloudVersion: data[0].version,
      cloudBaseline: fingerprint(local),
      lastSyncedAt: data[0].updated_at,
    });
  }
  if (useAuthStore.getState().user?.id !== owner) return;
  setConflict(null);
  useGameStore.setState({
    syncError: null,
    isOffline:
      fingerprint(captureGameState()) !==
      (choice === 'local' ? fingerprint(local) : fingerprint(remote.payload)),
  });
}

let running: Promise<void> | null = null;
export function syncGameState(): Promise<void> {
  if (resolving) return resolving.catch(() => undefined);
  if (running) return running;
  running = synchronize().finally(() => {
    running = null;
  });
  return running;
}

async function synchronize(): Promise<void> {
  const store = useGameStore;
  if (!isSupabaseConfigured || !useAuthStore.getState().user) return;
  const owner = useAuthStore.getState().user!.id;
  const stillSameUser = () => useAuthStore.getState().user?.id === owner;
  await reliableStorage.flush();
  if (!stillSameUser()) return;
  if (getStorageIssues().some((issue) => issue.blocked)) {
    store.setState({
      syncError:
        'Synchronisierung pausiert, bis die lokale Speicherung wieder sicher ist.',
      isOffline: true,
    });
    return;
  }
  store.setState({ syncing: true, syncError: null });
  try {
    const { cloudOwnerId, cloudVersion, cloudBaseline } = store.getState();
    if (cloudOwnerId && cloudOwnerId !== owner) {
      throw new Error(
        'Diese lokalen Spieldaten gehoeren zu einem anderen Konto. Bitte mit diesem Konto anmelden.',
      );
    }
    const { data: remote, error } = await supabase
      .from('game_states')
      .select('payload, version, updated_at')
      .eq('owner_id', owner)
      .maybeSingle();
    if (error) throw error;
    if (!stillSameUser()) return;
    const local = captureGameState();
    validateSnapshot(local);
    const localFingerprint = fingerprint(local);
    if (remote) {
      validateSnapshot(remote.payload);
      const remoteFingerprint = fingerprint(remote.payload);
      const unbound = cloudOwnerId === null;
      const dirty = cloudBaseline !== localFingerprint;
      if (
        localFingerprint === remoteFingerprint ||
        (unbound && !hasLocalData(local)) ||
        (!unbound && !dirty)
      ) {
        if (localFingerprint !== remoteFingerprint)
          await restoreSnapshot(
            remote.payload,
            owner,
            remote.version,
            remote.updated_at,
          );
        store.setState({
          cloudOwnerId: owner,
          cloudVersion: remote.version,
          cloudBaseline: remoteFingerprint,
          lastSyncedAt: remote.updated_at,
          isOffline: false,
        });
        await store.getState().persistGame();
        setConflict(null);
        return;
      }
      if (unbound || remote.version !== cloudVersion) {
        setConflict({
          ownerId: owner,
          local,
          remote: remote.payload,
          remoteVersion: remote.version,
          updatedAt: remote.updated_at,
        });
        throw new Error(
          'Synchronisierungskonflikt: Lokal und in der Cloud liegen unterschiedliche Aenderungen vor. Keine Daten wurden ueberschrieben.',
        );
      }
    } else if (cloudVersion !== null) {
      throw new Error(
        'Die Cloud-Sicherung fehlt. Lokale Daten bleiben erhalten.',
      );
    }
    // Bind local data before the upload, including when the connection fails.
    store.setState({ cloudOwnerId: owner });
    const { data: saved, error: saveError } = await supabase.rpc(
      'save_game_state',
      {
        p_payload: local,
        p_expected_version: remote?.version ?? 0,
      },
    );
    if (saveError) throw saveError;
    if (!stillSameUser()) return;
    const row = saved?.[0];
    if (!row) throw new Error('Die Cloud hat das Speichern nicht bestaetigt.');
    store.setState({
      cloudOwnerId: owner,
      cloudVersion: row.version,
      cloudBaseline: localFingerprint,
      lastSyncedAt: row.updated_at,
      isOffline: fingerprint(captureGameState()) !== localFingerprint,
    });
    setConflict(null);
  } catch (error) {
    if (stillSameUser())
      store.setState({
        isOffline: true,
        syncError:
          error instanceof Error
            ? error.message
            : ((error as { message?: string })?.message ??
              'Synchronisierung fehlgeschlagen. Lokale Daten bleiben erhalten.'),
      });
  } finally {
    store.setState({ syncing: false });
  }
}
