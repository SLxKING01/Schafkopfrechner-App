/**
 * Icon scale for Lucide icons. Use these through AppIcon instead of passing
 * raw numbers, so every screen draws icons at the same few sizes and weights.
 */
export const iconSizes = {
  /** Inline badges and tiny chips */
  xs: 14,
  /** Icons next to small text, search fields, compact buttons */
  sm: 18,
  /** Default: list rows, toolbar and menu actions */
  md: 20,
  /** Header buttons, close buttons, tab bar */
  lg: 24,
  /** Large round action buttons and empty states */
  xl: 28,
} as const;

export const iconStrokes = {
  regular: 2,
  /** Selected state and icons on gold or small filled buttons */
  strong: 2.5,
} as const;

export type IconSize = keyof typeof iconSizes;
export type IconWeight = keyof typeof iconStrokes;
