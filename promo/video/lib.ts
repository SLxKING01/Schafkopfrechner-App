import { Easing, interpolate } from 'remotion';

import { authColors } from '../../src/theme/colors';
import tokens from './generated/tokens.json';

export const FPS = 30;
/** 120 BPM: ein Schlag = 0,5 s = 15 Frames, ein Takt = 2 s = 60 Frames. */
export const BEAT = 15;
export const BAR = 4 * BEAT;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** Instagram/TikTok: oben, unten und rechts liegt Bedienoberfläche. */
export const SAFE = { top: 250, bottom: HEIGHT - 400, left: 90, right: 930 };

export const colors = authColors;
export { tokens };
export type SuitId = 'eichel' | 'gras' | 'herz' | 'schellen';
export const suit = (id: SuitId) => tokens.suits.find((s) => s.id === id)!;

/** Gleiche Kurve wie `src/theme/motion.ts`. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
/** 240 ms wie `formEntering`, 140 ms wie `selectionEntering`. */
export const ENTER = 7;
export const SELECT = 4;

export const ramp = (frame: number, start: number, duration = ENTER) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    easing: easeOut,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** Kurzes Überschwingen für „schnalzende“ Elemente. */
export const pop = (frame: number, start: number, duration = 9) =>
  interpolate(frame, [start, start + duration * 0.55, start + duration], [0, 1.08, 1], {
    easing: easeOut,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const font = (weight: 500 | 600 | 700 | 800 | 900) => ({
  fontFamily: 'Inter',
  fontWeight: weight,
});
