import { ChevronLeft, Layers, Pause, Play, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reliableStorage } from '../../storage/reliableStorage';
import { useGameStore } from '../../store/gameStore';
import {
  authColors,
  authRadius,
  authSpacing,
  authTextStyles,
} from '../../theme';
import type { Player } from '../../types/game';
import { AppText } from '../ui/AppText';

type Props = {
  tableId: string;
  players: Player[];
  dealerId: string | null;
  initialPlayerId: string | null;
  onClose: () => void;
};

/** Shared player-action entry point; further player actions can be added here. */
export function PlayerActionsMenu({
  tableId,
  players,
  dealerId,
  initialPlayerId,
  onClose,
}: Props) {
  const misdealEnabled = useGameStore(
    (state) => state.currentTable?.settings.misdealPenaltyEnabled,
  );
  const insets = useSafeAreaInsets();
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [busy, setBusy] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    'dealer' | 'pause' | 'misdeal'
  >('dealer');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const player = players.find(({ id }) => id === playerId);
  const isDealer = player?.id === dealerId;
  async function selectDealer(
    action: 'dealer' | 'pause' | 'misdeal' = 'dealer',
  ) {
    if (lock.current || !player) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (!needsRetry) {
        setPendingAction(action);
        const store = useGameStore.getState();
        const ok =
          action === 'pause'
            ? store.setPlayerPaused(tableId, player.id, !player.isPaused)
            : action === 'misdeal'
              ? store.recordMisdeal(tableId, player.id)
              : store.setDealer(tableId, player.id);
        if (!ok)
          throw new Error(
            'Der Tisch oder Spieler ist nicht mehr verfügbar. Bitte das Menü erneut öffnen.',
          );
        setNeedsRetry(true);
      }
      await reliableStorage.retryWrites();
      if (!(await reliableStorage.confirmWrite('schafkopfrechner-games')))
        throw new Error(
          'Die Geberauswahl ist noch nicht auf dem Gerät gesichert. Bitte erneut sichern.',
        );
      setNeedsRetry(false);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Die �nderung konnte nicht gespeichert werden.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View
        style={[
          s.root,
          { paddingBottom: Math.max(insets.bottom, authSpacing.lg) },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Spieleraktionen schließen"
          disabled={busy}
          onPress={onClose}
          style={s.backdrop}
        />
        <View style={s.card}>
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.header}>
              {player && initialPlayerId === null && !needsRetry ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Andere Spieleraktionen anzeigen"
                  disabled={busy}
                  onPress={() => setPlayerId(null)}
                  style={s.iconButton}
                >
                  <ChevronLeft size={20} color={authColors.textSecondary} />
                </Pressable>
              ) : null}
              <AppText accessibilityRole="header" style={s.title}>
                {player?.name ?? 'Spieleraktionen'}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Spieleraktionen abbrechen"
                disabled={busy}
                onPress={onClose}
                style={s.iconButton}
              >
                <X size={20} color={authColors.textSecondary} />
              </Pressable>
            </View>
            {player ? (
              <>
                {!player.isPaused &&
                (!needsRetry || pendingAction === 'dealer') ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      needsRetry
                        ? 'Geberauswahl erneut sichern'
                        : `${player.name} als Geber auswählen`
                    }
                    accessibilityState={{
                      disabled: busy || (isDealer && !needsRetry),
                    }}
                    disabled={busy || (isDealer && !needsRetry)}
                    onPress={() => void selectDealer(pendingAction)}
                    style={({ pressed }) => [s.action, pressed && s.pressed]}
                  >
                    <Layers
                      size={20}
                      color={
                        isDealer && !needsRetry
                          ? authColors.textSecondary
                          : authColors.goldHighlight
                      }
                    />
                    <AppText
                      style={[s.text, isDealer && !needsRetry && s.muted]}
                    >
                      {needsRetry
                        ? 'Erneut sichern'
                        : isDealer
                          ? 'Aktueller Geber'
                          : 'Als Geber auswählen'}
                    </AppText>
                    {busy ? (
                      <ActivityIndicator
                        size="small"
                        color={authColors.goldHighlight}
                      />
                    ) : null}
                  </Pressable>
                ) : null}
                {(misdealEnabled && isDealer && !needsRetry) ||
                (needsRetry && pendingAction === 'misdeal') ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void selectDealer('misdeal')}
                    style={({ pressed }) => [s.action, pressed && s.pressed]}
                  >
                    <X size={20} color={authColors.error} />
                    <AppText style={s.text}>
                      {needsRetry ? 'Erneut sichern' : 'Vergeben?'}
                    </AppText>
                  </Pressable>
                ) : null}
                {!needsRetry || pendingAction === 'pause' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      needsRetry
                        ? 'Spielerstatus erneut sichern'
                        : player.isPaused
                          ? `${player.name} wieder aktivieren`
                          : `${player.name} pausieren`
                    }
                    disabled={busy}
                    onPress={() => void selectDealer('pause')}
                    style={({ pressed }) => [s.action, pressed && s.pressed]}
                  >
                    {player.isPaused ? (
                      <Play size={20} color={authColors.goldHighlight} />
                    ) : (
                      <Pause size={20} color={authColors.goldHighlight} />
                    )}
                    <AppText style={s.text}>
                      {needsRetry
                        ? 'Erneut sichern'
                        : player.isPaused
                          ? 'Wieder aktivieren'
                          : 'Spieler pausieren'}
                    </AppText>
                  </Pressable>
                ) : null}
              </>
            ) : (
              players.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Aktionen für ${p.name}`}
                  onPress={() => {
                    setPlayerId(p.id);
                    setError('');
                  }}
                  style={({ pressed }) => [s.action, pressed && s.pressed]}
                >
                  <AppText style={[s.text, p.isPaused && s.muted]}>
                    {p.name}
                  </AppText>
                  {p.isPaused ? (
                    <AppText style={s.note}>Pausiert</AppText>
                  ) : null}
                  {p.id === dealerId ? (
                    <AppText style={s.note}>Geber</AppText>
                  ) : null}
                </Pressable>
              ))
            )}
            {error ? (
              <AppText accessibilityRole="alert" style={s.note}>
                {error}
              </AppText>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: authSpacing.lg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    backgroundColor: '#10251C',
    borderRadius: authRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: authColors.borderSoft,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  content: { paddingVertical: authSpacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: authSpacing.lg,
    paddingRight: authSpacing.xs,
    gap: authSpacing.xs,
  },
  title: {
    color: authColors.textPrimary,
    ...authTextStyles.subhead,
    fontWeight: '700',
    flex: 1,
    paddingVertical: authSpacing.sm,
  },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: authColors.textPrimary,
    ...authTextStyles.body,
    flex: 1,
    flexShrink: 1,
  },
  muted: { color: authColors.textSecondary },
  note: {
    ...authTextStyles.caption,
    color: authColors.textSecondary,
    paddingHorizontal: authSpacing.lg,
    paddingVertical: authSpacing.sm,
  },
  action: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: authSpacing.lg,
    paddingVertical: authSpacing.md,
    gap: authSpacing.md,
  },
  pressed: { backgroundColor: authColors.control },
});
