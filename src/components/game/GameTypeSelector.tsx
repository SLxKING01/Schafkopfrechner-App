import { Pressable, StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { GameType } from '../../types/game';
import { AppText } from '../ui/AppText';

const gameTypes: { id: GameType; label: string }[] = [
  { id: 'sauspiel', label: 'Sauspiel' },
  { id: 'solo', label: 'Solo' },
  { id: 'wenz', label: 'Wenz' },
  { id: 'ramsch', label: 'Ramsch' },
  { id: 'custom', label: 'Custom' },
];

type GameTypeSelectorProps = {
  selectedType: GameType;
  onSelect: (gameType: GameType) => void;
};

export function GameTypeSelector({
  selectedType,
  onSelect,
}: GameTypeSelectorProps) {
  return (
    <View style={styles.grid}>
      {gameTypes.map((gameType) => {
        const selected = selectedType === gameType.id;

        return (
          <Pressable
            key={gameType.id}
            accessibilityRole="button"
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
