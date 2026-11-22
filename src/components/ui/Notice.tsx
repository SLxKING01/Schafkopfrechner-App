import { StyleSheet, View } from 'react-native';

import { authColors, authSpacing } from '../../theme';
import { authTypography } from '../../theme/typography';
import { AppText } from './AppText';

type NoticeTone = 'error' | 'success' | 'info';

/** Inline status box: red for errors, green for confirmations, neutral for hints. */
export function Notice({
  children,
  tone = 'error',
}: {
  children: string;
  tone?: NoticeTone;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.box, styles[tone]]}>
      <AppText
        selectable
        accessibilityRole={tone === 'error' ? 'alert' : undefined}
        style={[styles.text, textStyles[tone]]}
      >
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.md - 2,
  },
  error: {
    backgroundColor: authColors.errorBackground,
    borderColor: authColors.errorBorder,
  },
  success: {
    backgroundColor: 'rgba(91, 190, 99, 0.12)',
    borderColor: 'rgba(91, 190, 99, 0.45)',
  },
  info: {
    backgroundColor: authColors.surfaceElevated,
    borderColor: authColors.borderSoft,
  },
  text: { fontSize: authTypography.label, fontWeight: '600', lineHeight: 20 },
});

const textStyles = StyleSheet.create({
  error: { color: authColors.errorText },
  success: { color: '#B7E6BC' },
  info: { color: authColors.textMutedGreen },
});
