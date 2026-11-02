import AsyncStorage from '@react-native-async-storage/async-storage';

import { reliableStorage } from '../storage/reliableStorage';
import { createTableVisibilityStore } from '../store/tableVisibilityStore';

beforeEach(async () => {
  await reliableStorage.flush();
  await AsyncStorage.clear();
});
afterEach(() => jest.restoreAllMocks());

it('keeps removed local and shared tables hidden after a fresh start, scoped to the account', async () => {
  const first = createTableVisibilityStore();
  await first.getState().hideTable('user:anna', 'local-table');
  await first.getState().hideTable('user:anna', 'shared-table');
  await first.getState().hideTable('guest', 'guest-table');
  const restarted = createTableVisibilityStore();
  await restarted.getState().hydrate();
  expect(restarted.getState().hiddenByScope).toEqual({
    'user:anna': ['local-table', 'shared-table'],
    guest: ['guest-table'],
  });
  expect(restarted.getState().hiddenByScope['user:berkay']).toBeUndefined();
});

it('serializes concurrent removals without losing an entry', async () => {
  const store = createTableVisibilityStore();
  await Promise.all([
    store.getState().hideTable('guest', 'one'),
    store.getState().hideTable('guest', 'two'),
    store.getState().hideTable('guest', 'one'),
  ]);
  const restarted = createTableVisibilityStore();
  await restarted.getState().hydrate();
  expect(restarted.getState().hiddenByScope.guest).toEqual(['one', 'two']);
});

it('keeps the table visible on a storage failure and allows retry', async () => {
  const store = createTableVisibilityStore();
  await store.getState().hydrate();
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await expect(store.getState().hideTable('guest', 'one')).rejects.toThrow(
    'nicht dauerhaft',
  );
  expect(store.getState().hiddenByScope.guest).toBeUndefined();
  await store.getState().hideTable('guest', 'one');
  const restarted = createTableVisibilityStore();
  await restarted.getState().hydrate();
  expect(restarted.getState().hiddenByScope.guest).toEqual(['one']);
});
