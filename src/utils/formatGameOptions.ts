import type { GameOptions } from '../models/GameOptions';

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  laufende: 0,
  schneider: false,
  schwarz: false,
};

export function normalizeGameOptions(
  options?: Partial<GameOptions>,
): GameOptions {
  return {
    ...DEFAULT_GAME_OPTIONS,
    ...options,
  };
}

export function formatGameOptions(options?: Partial<GameOptions>): string {
  const normalizedOptions = normalizeGameOptions(options);
  const activeOptions: string[] = [];

  if (normalizedOptions.laufende > 0) {
    activeOptions.push(`${normalizedOptions.laufende} Laufende`);
  }

  if (normalizedOptions.schneider) {
    activeOptions.push('Schneider');
  }

  if (normalizedOptions.schwarz) {
    activeOptions.push('Schwarz');
  }

  return activeOptions.join(' • ');
}
