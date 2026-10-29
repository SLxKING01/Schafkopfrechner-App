import { isLoaded } from 'expo-font';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { authColors, authTextStyles } from '../../theme';
import { fontFamilyForWeight } from '../../theme/typography';

type AppTextVariant = keyof typeof authTextStyles;

type AppTextProps = TextProps & {
  variant?: AppTextVariant;
};

export function AppText({
  children,
  variant = 'body',
  style,
  ...props
}: AppTextProps) {
  const textStyle = (StyleSheet.flatten([
    styles.base,
    authTextStyles[variant],
    style,
  ]) ?? {}) as TextStyle;
  const family = fontFamilyForWeight(textStyle.fontWeight);
  // Static font files carry their own weight; avoid synthesizing a second weight.
  const font =
    !textStyle.fontFamily && isLoaded(family)
      ? { fontFamily: family, fontWeight: 'normal' as const }
      : undefined;
  return (
    <Text {...props} style={[textStyle, font]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: authColors.textPrimary,
  },
});
