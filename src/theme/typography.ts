import type { TextStyle } from 'react-native';

import { authColors } from './colors';

export const authFontFamilies = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
  900: 'Inter_900Black',
} as const;

export function fontFamilyForWeight(weight: TextStyle['fontWeight']) {
  const numeric = weight === 'bold' ? 700 : Number(weight ?? 400);
  const nearest = Math.max(400, Math.min(900, Math.round(numeric / 100) * 100));
  return (
    authFontFamilies[nearest as keyof typeof authFontFamilies] ??
    authFontFamilies[400]
  );
}

export const authTypography = {
  hero: 34,
  title: 28,
  metric: 24,
  subtitle: 20,
  body: 16,
  caption: 13,
  tiny: 11,
  control: 12,
  label: 15,
  subhead: 18,
  amount: 36,
  button: 17,
};

export const authTextStyles = {
  balanceHero: {
    fontSize: 48,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  balanceHeroCompact: {
    fontSize: 40,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  subhead: { fontSize: authTypography.subhead, fontWeight: '400' },
  metric: {
    fontSize: authTypography.metric,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hero: { fontSize: authTypography.hero, fontWeight: '800' },
  title: { fontSize: authTypography.title, fontWeight: '700' },
  subtitle: { fontSize: authTypography.subtitle, fontWeight: '600' },
  body: { fontSize: authTypography.body },
  caption: {
    fontSize: authTypography.caption,
    lineHeight: 18,
    color: authColors.textSecondary,
  },
  tiny: { fontSize: authTypography.tiny, color: authColors.textSecondary },
  label: { fontSize: authTypography.label },
  control: { fontSize: authTypography.control },
  counter: { fontSize: authTypography.subhead, fontVariant: ['tabular-nums'] },
  amount: {
    fontSize: authTypography.amount,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  button: { fontSize: authTypography.button, fontWeight: '800' },
} satisfies Record<string, TextStyle>;
