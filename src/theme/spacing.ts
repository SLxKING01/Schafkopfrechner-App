import { Platform } from 'react-native';
export const authSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  lgPlus: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
};

export const authRadius = {
  sm: 16,
  md: 18,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const authControlSizes = {
  touch: Platform.OS === 'android' ? 48 : 44,
  field: 48,
  playerRow: 64,
  suit: 68,
  counter: 28,
  stepper: Platform.OS === 'android' ? 100 : 96,
  icon: 24,
  primaryButton: 60,
};

export const authInteraction = {
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
};
