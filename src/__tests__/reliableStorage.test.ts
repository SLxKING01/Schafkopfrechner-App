import { createReliableStorage } from '../storage/reliableStorage';

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
  const notify = jest.fn();
  const safe = createReliableStorage(
    storage,
    (_key, value) => typeof (value as { count?: unknown })?.count === 'number',
    notify,
  );
  return { values, storage, safe, notify };
}
it('serializes concurrent writes so an older save cannot replace a newer one', async () => {
  const { safe, storage, values } = fixture();
  let release!: () => void;
  storage.setItem.mockImplementationOnce(async (key, value) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    values.set(key, value);
  });
  const first = safe.setItem('game', '{"count":1}');
  const second = safe.setItem('game', '{"count":2}');
  for (let i = 0; i < 10 && !release; i++) await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  release();
  await Promise.all([first, second]);
  expect(await safe.getItem('game')).toBe('{"count":2}');
  expect(values.get('game.backup')).toBe('{"count":1}');
});
it.each(['{broken', '{"count":"wrong"}'])(
  'recovers a damaged snapshot %s while preserving the original',
  async (raw) => {
    const { safe, values, notify } = fixture();
    await safe.setItem('game', '{"count":1}');
    await safe.setItem('game', '{"count":2}');
    values.set('game', raw);
    expect(await safe.getItem('game')).toBe('{"count":1}');
    expect(values.get('game.damaged')).toBe(raw);
    expect(notify).toHaveBeenLastCalledWith(
      'game',
      expect.stringContaining('wiederhergestellt'),
    );
  },
);
it('does not overwrite unreadable data with empty defaults when there is no usable backup', async () => {
  const { safe, values, notify } = fixture();
  values.set('game', 'damaged');
  expect(await safe.getItem('game')).toBeNull();
  await safe.setItem('game', '{"count":0}');
  expect(values.get('game')).toBe('damaged');
  expect(notify).toHaveBeenLastCalledWith('game', expect.any(String), true);
});
it('finishes hydration after a failed read and blocks unsafe writes', async () => {
  const { safe, storage, notify } = fixture();
  storage.getItem.mockRejectedValueOnce(new Error('Device locked'));
  expect(await safe.getItem('game')).toBeNull();
  await safe.setItem('game', '{"count":0}');
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(notify).toHaveBeenLastCalledWith('game', expect.any(String), true);
});
it('retains the previous save after disk failure and retries the latest pending changes', async () => {
  const { safe, storage, values } = fixture();
  await safe.setItem('game', '{"count":1}');
  storage.setItem.mockRejectedValueOnce(new Error('Disk full'));
  await expect(safe.setItem('game', '{"count":2}')).resolves.toBeUndefined();
  expect(values.get('game')).toBe('{"count":1}');
  await safe.retryWrites();
  expect(values.get('game')).toBe('{"count":2}');
});

it('confirms only a successful write and keeps an unsaved warning after reading an older disk version', async () => {
  const { safe, storage, notify } = fixture();
  await safe.setItem('game', '{"count":1}');
  storage.setItem.mockRejectedValueOnce(new Error('Disk full'));
  await safe.setItem('game', '{"count":2}');
  expect(await safe.confirmWrite('game')).toBe(false);
  expect(await safe.getItem('game')).toBe('{"count":1}');
  expect(notify).toHaveBeenLastCalledWith(
    'game',
    expect.stringContaining('noch nicht'),
    true,
  );
  expect(await safe.confirmWrite('game')).toBe(false);
  await safe.retryWrites();
  expect(await safe.confirmWrite('game')).toBe(true);
});
it('rejects malformed output and removes backup on intentional clear', async () => {
  const { safe, values } = fixture();
  await safe.setItem('game', '{"count":1}');
  await safe.setItem('game', '{"count":2}');
  await safe.setItem('game', '{"count":"invalid"}');
  expect(values.get('game')).toBe('{"count":2}');
  await safe.removeItem('game');
  expect(await safe.getItem('game')).toBeNull();
  expect(values.has('game.backup')).toBe(false);
});

it('does not let a retry replace newer edits already queued for saving', async () => {
  const { safe, storage, values } = fixture();
  storage.setItem.mockRejectedValueOnce(new Error('Disk full'));
  await safe.setItem('game', '{"count":1}');
  const newer = safe.setItem('game', '{"count":2}');
  const retry = safe.retryWrites();
  await Promise.all([newer, retry]);
  expect(values.get('game')).toBe('{"count":2}');
});
it('recovers a missing primary record from its backup', async () => {
  const { safe, values } = fixture();
  values.set('game.backup', '{"count":3}');
  expect(await safe.getItem('game')).toBe('{"count":3}');
});

it('does not rotate the previous backup for an identical save', async () => {
  const { safe, values } = fixture();
  await safe.setItem('game', '{"count":1}');
  await safe.setItem('game', '{"count":2}');
  await safe.setItem('game', '{"count":2}');
  expect(values.get('game.backup')).toBe('{"count":1}');
});
