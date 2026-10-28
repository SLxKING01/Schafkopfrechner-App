import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  captureGameState,
  type CloudGameState,
  getSyncConflict,
  resolveSyncConflict,
  subscribeSyncConflict,
} from '../../services/sync/syncGameState';
import {
  getStorageIssues,
  reliableStorage,
  subscribeStorageIssues,
} from '../../storage/reliableStorage';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { getStockBalanceCents, isStockBooking } from '../../utils/accounting';
import { formatOverviewMoney } from '../../utils/gameOverview';
import { GoldButton } from '../auth/GoldButton';
import { AppText } from '../ui/AppText';

export function SyncStatus() {
  const conflict = useSyncExternalStore(
    subscribeSyncConflict,
    getSyncConflict,
    getSyncConflict,
  );
  const issues = useSyncExternalStore(
    subscribeStorageIssues,
    getStorageIssues,
    getStorageIssues,
  );
  const userId = useAuthStore((state) => state.user?.id);
  const rounds = useGameStore((state) => state.rounds);
  const table = useGameStore((state) => state.currentTable);
  const syncing = useGameStore((state) => state.syncing);
  const syncError = useGameStore((state) => state.syncError);
  const lastSyncedAt = useGameStore((state) => state.lastSyncedAt);
  const isOffline = useGameStore((state) => state.isOffline);
  const [deviceCheck, setDeviceCheck] = useState<{
    rounds: typeof rounds;
    table: typeof table;
    issues: typeof issues;
    saved: boolean;
  } | null>(null);
  const device =
    deviceCheck?.rounds === rounds &&
    deviceCheck?.table === table &&
    deviceCheck?.issues === issues
      ? deviceCheck.saved
        ? 'Auf Gerät gespeichert'
        : 'Auf Gerät noch nicht gesichert'
      : 'Gerätespeicherung wird geprüft …';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    void reliableStorage
      .confirmWrite('schafkopfrechner-games')
      .then((saved) => {
        if (!disposed) setDeviceCheck({ rounds, table, issues, saved });
      });
    return () => {
      disposed = true;
    };
  }, [rounds, table, issues]);
  const ownConflict = conflict?.ownerId === userId ? conflict : null;
  async function choose(choice: 'local' | 'remote') {
    if (!ownConflict || busy) return;
    setBusy(true);
    setError('');
    try {
      await resolveSyncConflict(choice, ownConflict);
      setOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : ((reason as { message?: string })?.message ??
              'Übernahme fehlgeschlagen. Bitte erneut prüfen.'),
      );
    } finally {
      setBusy(false);
    }
  }
  function summary(title: string, snapshot: CloudGameState) {
    return (
      <View style={styles.summary}>
        <AppText style={styles.gold}>{title}</AppText>
        <AppText>
          {snapshot.currentTable?.name ?? 'Kein aktueller Tisch'}
        </AppText>
        <AppText>
          {snapshot.rounds.filter((round) => !isStockBooking(round)).length}{' '}
          Spiele am Tisch · {snapshot.archivedGameDays?.length ?? 0} archivierte
          Tische · {snapshot.games.length} ältere Spiele
        </AppText>
        <AppText>
          {snapshot.players.map(({ name }) => name).join(', ') ||
            'Keine Tischspieler'}
        </AppText>
        <AppText>
          Stock: {formatOverviewMoney(getStockBalanceCents(snapshot.rounds))}
        </AppText>
        {snapshot.players.map((player) => (
          <AppText key={player.id}>
            {player.name}:{' '}
            {formatOverviewMoney(
              Math.round(
                (snapshot.balances.find(
                  ({ playerId }) => playerId === player.id,
                )?.amount ?? 0) * 100,
              ),
            )}
          </AppText>
        ))}
      </View>
    );
  }
  return (
    <>
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <AppText style={styles.caption}>{device}</AppText>
        {userId ? (
          <AppText style={styles.caption}>
            {ownConflict
              ? 'Cloud-Konflikt: keine Fassung überschrieben'
              : syncing
                ? 'Cloud-Abgleich läuft …'
                : syncError
                  ? 'Cloud-Abgleich fehlgeschlagen'
                  : isOffline
                    ? 'Cloud-Abgleich ausstehend'
                    : lastSyncedAt
                      ? `Letzter Cloud-Abgleich: ${new Date(lastSyncedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Noch keine Cloud-Sicherung bestätigt'}
          </AppText>
        ) : (
          <AppText style={styles.caption}>
            Lokaler Spielmodus · ohne Cloud-Abgleich
          </AppText>
        )}
        {ownConflict ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sicherungsfassungen vergleichen"
            style={styles.action}
            onPress={() => {
              setError('');
              setOpen(true);
            }}
          >
            <AppText style={styles.gold}>Fassungen vergleichen</AppText>
          </Pressable>
        ) : userId && syncError ? (
          <Pressable
            accessibilityRole="button"
            style={styles.action}
            onPress={() => {
              void useGameStore.getState().syncNow();
            }}
          >
            <AppText style={styles.gold}>
              Cloud-Abgleich erneut versuchen
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <Modal
        transparent
        visible={open && !!ownConflict}
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <View style={styles.modal}>
          <ScrollView
            style={styles.dialog}
            contentContainerStyle={styles.content}
          >
            <AppText variant="title">Sicherungsfassungen vergleichen</AppText>
            <AppText>
              Es wird eine vollständige Fassung übernommen. Runden werden nicht
              automatisch vermischt. Beide Fassungen werden vorher auf diesem
              Gerät gesichert.
            </AppText>
            {ownConflict ? (
              <>
                {summary('Dieses Gerät', captureGameState())}
                {summary('Cloud', ownConflict.remote)}
              </>
            ) : null}
            {error ? <AppText style={styles.error}>{error}</AppText> : null}
            <GoldButton
              title="Gerätefassung verwenden"
              disabled={busy}
              loading={busy}
              onPress={() => {
                void choose('local');
              }}
            />
            <GoldButton
              title="Cloud-Fassung verwenden"
              disabled={busy}
              onPress={() => {
                void choose('remote');
              }}
            />
            <Pressable
              accessibilityRole="button"
              style={styles.action}
              disabled={busy}
              onPress={() => setOpen(false)}
            >
              <AppText>Abbrechen</AppText>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  status: { gap: 2, paddingVertical: 4 },
  caption: { color: '#A8B9AD', fontSize: 12 },
  gold: { color: '#E7C65C', fontWeight: '700' },
  action: { minHeight: 44, justifyContent: 'center' },
  modal: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  dialog: { maxHeight: '90%', backgroundColor: '#10241C', borderRadius: 20 },
  content: { gap: 16, padding: 20 },
  summary: {
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: '#536D57',
  },
  error: { color: '#FFC3A3' },
});
