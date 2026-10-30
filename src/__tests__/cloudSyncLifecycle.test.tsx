import { act } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useCloudSync } from '../hooks/useCloudSync';

const renderer = jest.requireActual('react-test-renderer');
const mockSync = jest.fn().mockResolvedValue(undefined);
const mockSetState = jest.fn();
const mockListeners = new Set<() => void>();
let mockUserId: string | undefined = 'user-a';
let mockFingerprint = 'initial';

jest.mock('../store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({ user: { id: mockUserId } }),
    { getState: () => ({ user: { id: mockUserId } }) },
  ),
}));
jest.mock('../store/gameStore', () => ({
  useGameStore: {
    getState: () => ({ syncNow: mockSync }),
    setState: (...args: unknown[]) => mockSetState(...args),
    subscribe: (listener: () => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));
jest.mock('../store/playerStore', () => ({
  usePlayerStore: { subscribe: () => () => undefined },
}));
jest.mock('../store/matchDayStore', () => ({
  useMatchDayStore: { subscribe: () => () => undefined },
}));
jest.mock('../services/sync/syncGameState', () => ({
  captureGameState: () => mockFingerprint,
  fingerprint: (value: string) => value,
  applyingCloudState: false,
}));

function Harness({ ready = true }: { ready?: boolean }) {
  useCloudSync(ready);
  return null;
}

let changeState: (state: AppStateStatus) => void;
const remove = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  mockSync.mockReset().mockResolvedValue(undefined);
  mockSetState.mockClear();
  remove.mockClear();
  mockUserId = 'user-a';
  mockFingerprint = 'initial';
  AppState.currentState = 'active';
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      changeState = listener;
      return { remove };
    });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('pauses debounce and polling while inactive and syncs on return', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<Harness />);
  });
  expect(mockSync).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockFingerprint = 'edited';
    mockListeners.forEach((listener) => listener());
    AppState.currentState = 'inactive';
    changeState('inactive');
    jest.advanceTimersByTime(60000);
  });
  expect(mockSync).toHaveBeenCalledTimes(1);
  await act(async () => {
    AppState.currentState = 'active';
    changeState('active');
  });
  expect(mockSync).toHaveBeenCalledTimes(2);
  await act(async () => view.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
  expect(mockListeners.size).toBe(0);
  await act(async () => {
    jest.advanceTimersByTime(60000);
  });
  expect(mockSync).toHaveBeenCalledTimes(2);
});

it('does not start queued requests for a signed-out account', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<Harness />);
  });
  mockUserId = undefined;
  await act(async () => {
    jest.advanceTimersByTime(30000);
  });
  expect(mockSync).toHaveBeenCalledTimes(1);
  await act(async () => view.unmount());
});

it('reports unexpected failures without clearing local game data', async () => {
  mockSync.mockRejectedValueOnce(new Error('storage unavailable'));
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<Harness />);
  });
  expect(mockSetState).toHaveBeenCalledWith({
    isOffline: true,
    syncError: expect.stringContaining('Lokale Daten bleiben erhalten'),
  });
  await act(async () => {
    jest.advanceTimersByTime(30000);
  });
  expect(mockSync).toHaveBeenCalledTimes(2);
  await act(async () => view.unmount());
});

it('waits for hydration before starting automatic sync', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<Harness ready={false} />);
  });
  expect(mockSync).not.toHaveBeenCalled();
  await act(async () => view.update(<Harness />));
  expect(mockSync).toHaveBeenCalledTimes(1);
  await act(async () => view.unmount());
});
