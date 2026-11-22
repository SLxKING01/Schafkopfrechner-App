import {
  Alert,
  type AlertButton,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { create } from 'zustand';

import { authColors, authRadius, authSpacing } from '../../theme';
import { GoldButton } from '../auth/GoldButton';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type Dialog = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
};

const useDialogStore = create<{ queue: Dialog[] }>(() => ({ queue: [] }));
let nextId = 1;

/**
 * Drop-in replacement for `Alert.alert`. Native platforms keep the system
 * dialog; on the web, where `Alert.alert` does nothing, an in-app dialog is
 * shown instead (rendered by `AppDialogHost`).
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  useDialogStore.setState((state) => ({
    queue: [
      ...state.queue,
      {
        id: nextId++,
        title,
        message,
        buttons: buttons?.length ? buttons : [{ text: 'OK' }],
      },
    ],
  }));
}

function close(dialog: Dialog, button?: AlertButton) {
  useDialogStore.setState((state) => ({
    queue: state.queue.filter((item) => item.id !== dialog.id),
  }));
  button?.onPress?.();
}

export function AppDialogHost() {
  const dialog = useDialogStore((state) => state.queue[0]);
  if (!dialog) return null;
  const cancel = dialog.buttons.find((button) => button.style === 'cancel');
  // Primary action first, cancel last – like the rest of the app.
  const ordered = [
    ...dialog.buttons.filter((button) => button.style !== 'cancel'),
    ...(cancel ? [cancel] : []),
  ];
  const primary = ordered.find(
    (button) => button.style !== 'cancel' && button.style !== 'destructive',
  );
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => close(dialog, cancel)}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={styles.card}
        >
          <AppText accessibilityRole="header" style={styles.title}>
            {dialog.title}
          </AppText>
          {dialog.message ? (
            <AppText style={styles.message}>{dialog.message}</AppText>
          ) : null}
          <View style={styles.actions}>
            {ordered.map((button, index) => {
              const label = button.text ?? 'OK';
              const onPress = () => close(dialog, button);
              if (button === primary)
                return (
                  <GoldButton key={index} title={label} onPress={onPress} />
                );
              return (
                <AppButton
                  key={index}
                  title={label}
                  variant={
                    button.style === 'destructive' ? 'danger' : 'secondary'
                  }
                  onPress={onPress}
                />
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: authColors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: authSpacing.xl,
  },
  card: {
    backgroundColor: authColors.surface,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    gap: authSpacing.md,
    maxWidth: 420,
    padding: authSpacing.xl,
    width: '100%',
  },
  title: { color: authColors.textPrimary, fontSize: 19, fontWeight: '800' },
  message: { color: authColors.textMutedGreen, fontSize: 15, lineHeight: 21 },
  actions: { gap: authSpacing.sm, marginTop: authSpacing.sm },
});
