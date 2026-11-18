import { Alert, type AlertButton, Platform } from 'react-native';

export type AppAlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
};

let queue: AppAlertRequest[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeAppAlerts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentAppAlert(): AppAlertRequest | null {
  return queue[0] ?? null;
}

/**
 * Resolves the visible web alert. It is removed before the button's handler
 * runs, so a handler may open a follow-up alert.
 */
export function resolveAppAlert(id: number, button?: AlertButton) {
  if (queue[0]?.id !== id) return;
  queue = queue.slice(1);
  emit();
  button?.onPress?.();
}

/**
 * Drop-in replacement for Alert.alert. Native platforms keep the system
 * alert; on the web (where Alert.alert does nothing) AppAlertHost renders it.
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
  queue = [
    ...queue,
    {
      id: nextId++,
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
    },
  ];
  emit();
}

/** Test helper: forget pending web alerts. */
export function resetAppAlerts() {
  queue = [];
  emit();
}
