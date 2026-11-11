import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import {
  getCurrentAppAlert,
  resolveAppAlert,
  subscribeAppAlerts,
} from '../lib/appAlert';
import { authColors } from '../theme/colors';
import { GoldButton } from './auth/GoldButton';
import { AppText } from './ui/AppText';

/** Renders appAlert requests on the web, one at a time. */
export function AppAlertHost() {
  const alert = useSyncExternalStore(
    subscribeAppAlerts,
    getCurrentAppAlert,
    getCurrentAppAlert,
  );
  if (!alert) return null;
  const cancel = alert.buttons.find((button) => button.style === 'cancel');
  const actions = alert.buttons.filter((button) => button !== cancel);
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => resolveAppAlert(alert.id, cancel)}
    >
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={styles.card}
        >
          <AppText accessibilityRole="header" style={styles.title}>
            {alert.title}
          </AppText>
          {alert.message ? (
            <AppText style={styles.message}>{alert.message}</AppText>
          ) : null}
          {actions.map((button, index) =>
            button.style === 'destructive' ? (
              <Pressable
                key={`${button.text}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={button.text}
                onPress={() => resolveAppAlert(alert.id, button)}
                style={({ pressed }) => [
                  styles.destructive,
                  pressed && styles.pressed,
                ]}
              >
                <AppText style={styles.destructiveText}>{button.text}</AppText>
              </Pressable>
            ) : (
              <GoldButton
                key={`${button.text}-${index}`}
                title={button.text ?? 'OK'}
                accessibilityLabel={button.text}
                onPress={() => resolveAppAlert(alert.id, button)}
              />
            ),
          )}
          {cancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancel.text}
              onPress={() => resolveAppAlert(alert.id, cancel)}
              style={({ pressed }) => [
                styles.cancel,
                pressed && styles.pressed,
              ]}
            >
              <AppText style={styles.cancelText}>
                {cancel.text ?? 'Abbrechen'}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: authColors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    backgroundColor: '#142A20',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: { color: authColors.textSecondary, lineHeight: 22 },
  destructive: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: authColors.errorBorder,
    backgroundColor: authColors.errorBackground,
  },
  destructiveText: { color: authColors.errorText, fontWeight: '700' },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: authColors.textSecondary, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
