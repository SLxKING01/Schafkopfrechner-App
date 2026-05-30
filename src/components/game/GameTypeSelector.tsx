import { Pressable, StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { GameType } from '../../types/game';
import { AppText } from '../ui/AppText';

const gameTypes: { id: GameType; label: string }[] = [
  { id: 'rufspiel', label: 'Rufspiel' },
  { id: 'solo', label: 'Solo' },
  { id: 'wenz', label: 'Wenz' },
  { id: 'farbwenz', label: 'FarbWenz' },
  { id: 'geier', label: 'Geier' },
  { id: 'farbgeier', label: 'Farbgeier' },
  { id: 'ramsch', label: 'Ramsch' },
  { id: 'bettel', label: 'Bettel' },
  { id: 'hochzeit', label: 'Hochzeit' },
  { id: 'kreuzbock', label: 'Kreuzbock' },
  { id: 'stock', label: 'Stock' },
];

type GameTypeSelectorProps = {
  enabledTypes?: GameType[];
  selectedType: GameType;
  onSelect: (gameType: GameType) => void;
};

export function GameTypeSelector({
  enabledTypes,
  selectedType,
  onSelect,
}: GameTypeSelectorProps) {
  const enabledTypeSet = enabledTypes ? new Set(enabledTypes) : null;
  const visibleGameTypes = enabledTypeSet
    ? gameTypes.filter((gameType) => enabledTypeSet.has(gameType.id))
    : gameTypes;

  return (
    <View style={styles.grid}>
      {visibleGameTypes.map((gameType) => {
        const selected = selectedType === gameType.id;

        return (
          <Pressable
            key={gameType.id}
            accessibilityLabel={`Spieltyp ${gameType.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(gameType.id)}
            style={[styles.card, selected && styles.selected]}
          >
            <AppText style={[styles.text, selected && styles.selectedText]}>
              {gameType.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
  card: {
    backgroundColor: 'rgba(13, 27, 19, 0.76)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.md,
  },
  selected: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: authColors.gold,
  },
  text: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    fontWeight: '800',
  },
  selectedText: {
    color: authColors.goldHighlight,
  },
});
