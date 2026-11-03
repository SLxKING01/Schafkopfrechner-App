import { CheckCircle2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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
  message = 'Spiel gelöscht',
  undoLabel = 'Gelöschtes Spiel rückgängig machen',
  disabled = false,
}: {
  onUndo: () => Promise<string | undefined> | string | undefined | void;
  onDismiss: () => void;
  message?: string;
  undoLabel?: string;
  disabled?: boolean;
}) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (busy || error) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    if (Platform.OS === 'ios')
      AccessibilityInfo.announceForAccessibility(
        `${message}. Rückgängig ist verfügbar.`,
      );
    const timeout =
      Platform.OS === 'android'
        ? AccessibilityInfo.getRecommendedTimeoutMillis(5000)
        : AccessibilityInfo.isScreenReaderEnabled().then((enabled) =>
            enabled ? 20000 : 5000,
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
  }, [onDismiss, message, busy, error]);
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
        <AppText style={styles.label}>{message}</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={undoLabel}
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={async () => {
          if (lock.current || disabled) return;
          lock.current = true;
          setBusy(true);
          setError(undefined);
          try {
            const failure = await onUndo();
            if (failure) setError(failure);
            else onDismiss();
          } catch {
            setError(
              'Die Rücknahme konnte nicht gespeichert werden. Bitte erneut versuchen.',
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
        style={styles.action}
      >
        <AppText style={styles.gold}>
          {busy ? 'Speichert …' : error ? 'Erneut versuchen' : 'Rückgängig'}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rückgängig-Meldung schließen"
        disabled={busy}
        onPress={onDismiss}
        style={styles.action}
      >
        <X size={18} color={authColors.textSecondary} />
      </Pressable>
      {error ? (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  notice: {
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
  error: { flexBasis: '100%', color: authColors.textSecondary, fontSize: 13 },
  action: {
    minHeight: authControlSizes.touch,
    paddingHorizontal: authSpacing.sm,
    justifyContent: 'center',
  },
  gold: { fontSize: 15, color: authColors.goldHighlight, fontWeight: '600' },
});
