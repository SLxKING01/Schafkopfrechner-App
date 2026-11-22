import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  clearSessionChoice,
  rememberSessionChoice,
  shouldDiscardStoredSession,
} from '../services/auth/sessionPersistence';

afterEach(async () => {
  await AsyncStorage.clear();
});

test('keeps the session when "Angemeldet bleiben" is on', async () => {
  await rememberSessionChoice(true);
  expect(await shouldDiscardStoredSession()).toBe(false);
});

test('ends a temporary session after a native restart', async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'ios' });
  try {
    await rememberSessionChoice(false);
    expect(await shouldDiscardStoredSession()).toBe(true);
    await clearSessionChoice();
    expect(await shouldDiscardStoredSession()).toBe(false);
  } finally {
    Object.defineProperty(Platform, 'OS', { value: original });
  }
});
