import { type ReactNode, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authColors } from '../../theme/colors';
import { authControlSizes, authRadius, authSpacing } from '../../theme/spacing';
import type { GameRound, GameTable, Player } from '../../types/game';
import { formatRoundGameType } from '../../utils/cardSuits';
import { AppText } from '../ui/AppText';
import { RoundHistoryContent } from './RoundHistoryView';

type Props = {
  table: GameTable;
  players: Player[];
  rounds: GameRound[];
  round: GameRound;
  onEdit?: () => void;
  onDelete?: () => void;
  children: ReactNode;
};

export function RoundHistoryActions({
  table,
  players,
  rounds,
  round,
  onEdit,
  onDelete,
  children,
}: Props) {
  const [mode, setMode] = useState<'menu' | 'history' | null>(null);
  const number = rounds.findIndex((r) => r.id === round.id) + 1;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Aktionen für Eintrag ${number} öffnen`}
        accessibilityHint="Spiel bearbeiten oder Änderungsverlauf ansehen"
        onPress={() => setMode('menu')}
        onLongPress={() => setMode('menu')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.card}>{children}</View>
      </Pressable>
      {mode ? (
        <Modal
          transparent
          visible
          animationType="none"
          onRequestClose={() => setMode(null)}
        >
          {mode === 'history' ? (
            <RoundHistoryContent
              table={table}
              players={players}
              rounds={rounds}
              roundId={round.id}
              onClose={() => setMode(null)}
            />
          ) : (
            <SafeAreaView style={styles.menuRoot}>
              <Pressable
                accessible={false}
                style={styles.backdrop}
                onPress={() => setMode(null)}
              />
              <View style={styles.menu} accessibilityViewIsModal>
                <AppText style={styles.title}>
                  {round.misdealPlayerId
                    ? 'Vergeber'
                    : formatRoundGameType(round.gameType, round.suit)}
                </AppText>
                {onEdit ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Spiel bearbeiten"
                    style={styles.item}
                    onPress={() => {
                      setMode(null);
                      onEdit();
                    }}
                  >
                    <AppText>Spiel bearbeiten</AppText>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Änderungsverlauf"
                  style={styles.item}
                  onPress={() => setMode('history')}
                >
                  <AppText style={styles.gold}>Änderungsverlauf</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    onDelete
                      ? 'Spiel l\u00f6schen'
                      : 'Spielaktionen schlie\u00dfen'
                  }
                  style={styles.item}
                  onPress={() => {
                    setMode(null);
                    onDelete?.();
                  }}
                >
                  <AppText style={onDelete ? styles.danger : styles.note}>
                    {onDelete ? 'Spiel l\u00f6schen' : 'Schlie\u00dfen'}
                  </AppText>
                </Pressable>
              </View>
            </SafeAreaView>
          )}
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.surface,
  },
  card: { flex: 1, minWidth: 0 },
  menuRoot: { flex: 1, justifyContent: 'center', padding: authSpacing.xl },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: authColors.overlay },
  menu: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    padding: authSpacing.lg,
    backgroundColor: authColors.surface,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    gap: authSpacing.xs,
  },
  title: { fontSize: 17, fontWeight: '600', padding: authSpacing.sm },
  item: {
    minHeight: authControlSizes.touch,
    padding: authSpacing.sm,
    justifyContent: 'center',
  },
  gold: { color: authColors.goldHighlight },
  danger: { color: authColors.errorText },
  note: { color: authColors.textSecondary },
});
