import { Pressable, StyleSheet } from 'react-native';

import { theme } from '../constants/theme';
import type { GameType } from '../models/GameType';
import { AppText } from './ui/AppText';

type GameTypeCardProps = {
  gameType: GameType;
  isSelected: boolean;
  onPress: () => void;
};

export function GameTypeCard({
  gameType,
  isSelected,
  onPress,
}: GameTypeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isSelected && styles.selectedCard,
        pressed && styles.pressed,
      ]}
    >
      <AppText
        variant="subtitle"
        style={isSelected ? styles.selectedText : undefined}
      >
        {gameType.name}
      </AppText>
      <AppText
        variant="caption"
        style={isSelected ? styles.selectedText : undefined}
      >
        {gameType.baseAmount} €
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.xs,
    minWidth: 128,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  selectedCard: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectedText: {
    color: theme.colors.primaryText,
  },
  pressed: {
    opacity: 0.85,
  },
});
