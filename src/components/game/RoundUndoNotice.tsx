import { CheckCircle2 } from 'lucide-react-native';
import { useEffect } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { authColors } from '../../theme/colors';
import { selectionEntering } from '../../theme/motion';
import { authControlSizes, authRadius, authSpacing } from '../../theme/spacing';
import { AppText } from '../ui/AppText';

export function RoundUndoNotice({
  onUndo,
  onDismiss,
}: {
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    if (Platform.OS === 'ios')
      AccessibilityInfo.announceForAccessibility(
        'Spiel gelöscht. Rückgängig ist verfügbar.',
      );
    const timeout =
      Platform.OS === 'android'
        ? AccessibilityInfo.getRecommendedTimeoutMillis(8000)
        : AccessibilityInfo.isScreenReaderEnabled().then((enabled) =>
            enabled ? 20000 : 8000,
          );
    void timeout
      .catch(() => 20000)
      .then((duration) => {
        if (!cancelled) timer = setTimeout(onDismiss, duration);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [onDismiss]);
  return (
    <Animated.View entering={selectionEntering} style={styles.notice}>
      <View style={styles.copy} accessibilityLiveRegion="polite">
        <CheckCircle2
          size={22}
          color={authColors.accentGreen}
          {...(Platform.OS === 'web'
            ? { 'aria-hidden': true }
            : { accessible: false })}
        />
        <AppText style={styles.label}>Spiel gelöscht</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gelöschtes Spiel rückgängig machen"
        onPress={onUndo}
        style={styles.action}
      >
        <AppText style={styles.gold}>Rückgängig</AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: authSpacing.lg,
    marginVertical: authSpacing.sm,
    padding: authSpacing.sm,
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: authSpacing.sm,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    paddingHorizontal: authSpacing.sm,
    flexGrow: 1,
  },
  label: { fontSize: 15, color: authColors.textPrimary, flexShrink: 1 },
  action: {
    minHeight: authControlSizes.touch,
    paddingHorizontal: authSpacing.sm,
    justifyContent: 'center',
  },
  gold: { fontSize: 15, color: authColors.goldHighlight, fontWeight: '600' },
});
