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
  children: ReactNode;
};

export function RoundHistoryActions({
  table,
  players,
  rounds,
  round,
  onEdit,
  children,
}: Props) {
  const [mode, setMode] = useState<'menu' | 'history' | null>(null);
  const number = rounds.findIndex((r) => r.id === round.id) + 1;
  return (
    <>
      <View style={styles.row}>
        <View style={styles.card}>{children}</View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Aktionen für Eintrag ${number} öffnen`}
          onPress={() => setMode('menu')}
          style={styles.more}
        >
          <AppText style={styles.dots}>⋯</AppText>
        </Pressable>
      </View>
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
                  {formatRoundGameType(round.gameType, round.suit)}
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
                  accessibilityLabel="Spielaktionen schließen"
                  style={styles.item}
                  onPress={() => setMode(null)}
                >
                  <AppText style={styles.note}>Schließen</AppText>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.surface,
  },
  card: { flex: 1, minWidth: 0 },
  more: {
    width: authControlSizes.touch,
    minHeight: authControlSizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { fontSize: 25, color: authColors.textSecondary },
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
  note: { color: authColors.textSecondary },
});
