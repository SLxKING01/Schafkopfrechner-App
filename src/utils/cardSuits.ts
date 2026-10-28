import { gameRuleDefinitions } from '../constants/tableSettings';
import type { CardSuit } from '../types/game';

export const cardSuits: { id: CardSuit; label: string; color: string }[] = [
  { id: 'eichel', label: 'Eichel', color: '#C8944D' },
  { id: 'gras', label: 'Gras', color: '#6FA972' },
  { id: 'herz', label: 'Herz', color: '#E0635C' },
  { id: 'schellen', label: 'Schellen', color: '#E7C65C' },
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
        ? 'Freies Spiel'
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
