import { gameRuleDefinitions } from '../constants/tableSettings';
import { authColors } from '../theme/colors';
import type { CardSuit } from '../types/game';

export const cardSuits: { id: CardSuit; label: string; color: string }[] = [
  { id: 'eichel', label: 'Eichel', color: authColors.suitEichel },
  { id: 'gras', label: 'Gras', color: authColors.suitGras },
  { id: 'herz', label: 'Herz', color: authColors.suitHerz },
  { id: 'schellen', label: 'Schellen', color: authColors.suitSchellen },
];

export function supportsCardSuit(gameType: string) {
  return [
    'rufspiel',
    'sauspiel',
    'solo',
    'wenz',
    'farbwenz',
    'geier',
    'farbgeier',
  ].includes(gameType);
}

export function formatRoundGameType(gameType: string, suit?: CardSuit) {
  const label =
    gameRuleDefinitions.find(({ id }) => id === gameType)?.label ??
    (gameType === 'sauspiel'
      ? 'Sauspiel'
      : gameType === 'custom'
        ? 'Eigenes Spiel'
        : gameType);
  if (!suit || !supportsCardSuit(gameType)) return label;
  const prefix = cardSuits.find(({ id }) => id === suit)?.label;
  const suffix =
    gameType === 'farbwenz'
      ? 'wenz'
      : gameType === 'farbgeier'
        ? 'geier'
        : label.toLowerCase();
  return prefix ? `${prefix}${suffix}` : label;
}
