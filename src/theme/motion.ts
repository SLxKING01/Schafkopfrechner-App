import { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated';

const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

// Shared, delay-free entrances keep frequently used forms responsive.
export const formEntering = FadeIn.duration(240)
  .easing(easeOut)
  .reduceMotion(ReduceMotion.System);

export const selectionEntering = FadeIn.duration(140)
  .easing(easeOut)
  .reduceMotion(ReduceMotion.System);
