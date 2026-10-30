import Svg, { Path } from 'react-native-svg';

import type { CardSuit } from '../../types/game';

/** German playing-card suits, drawn as vectors so they stay crisp at any size. */
export function CardSuitIcon({
  suit,
  color,
  size = 28,
}: {
  suit: CardSuit;
  color: string;
  size?: number;
}) {
  const paths: Record<CardSuit, string> = {
    eichel:
      'M11 3h2v4h-2z M6 10c0-4 12-4 12 0v2H6z M7 13h10c0 5-3 7-5 8-2-1-5-3-5-8z',
    gras: 'M12 2C9 6 4 9 4 13a8 8 0 0 0 7 8V11h2v10a8 8 0 0 0 7-8c0-4-5-7-8-11z',
    herz: 'M12 21 3 12C-3 4 7-1 12 6 17-1 27 4 21 12z',
    schellen:
      'M10 3a2 2 0 0 1 4 0v2h-4z M12 6a7 7 0 0 1 7 7v4H5v-4a7 7 0 0 1 7-7z M5 18h14v2H5z M10 21h4v2h-4z',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d={paths[suit]} fill={color} />
    </Svg>
  );
}
