import { readOwnProfile, saveOwnProfile } from '../services/profile/profiles';
import { keepProfileDraft } from '../services/profile/profileStorage';
import { useAuthStore } from '../store/authStore';
import type { OwnProfile, ProfileDraft } from '../types/profile';
import { profileFields } from '../utils/profile';
const mockRpc = jest.fn(),
  mockUpload = jest.fn(),
  mockList = jest.fn(async () => ({ data: [], error: null }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => ({ abortSignal: () => mockRpc(...args) }),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        list: () => mockList(),
        remove: jest.fn(async () => ({ data: [], error: null })),
      }),
    },
  },
}));
jest.mock('../services/profile/profilePhoto', () => ({
  profilePhotoBytes: jest.fn(async () => new ArrayBuffer(4)),
}));
jest.mock('../services/profile/profileStorage', () => ({
  keepProfileDraft: jest.fn(async () => {}),
  cacheOwnProfile: jest.fn(async () => {}),
}));
const actor = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
let server: OwnProfile;
let operations: Set<string>;
function draft(): ProfileDraft {
  return {
    fields: { ...profileFields(server), firstName: '  Zoë  ' },
    version: server.version,
    operationId: '20000000-0000-4000-8000-000000000001',
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  operations = new Set();
  server = {
    id: actor,
    displayName: 'Simon',
    firstName: '',
    lastName: '',
    birthDate: null,
    avatarKind: 'none',
    animalId: null,
    accentId: 'forestGreen',
    photoPath: null,
    version: 1,
    updatedAt: '2026-11-02T19:00:00Z',
    setupCompleted: true,
  };
  useAuthStore.setState({ user: { id: actor } as never });
  mockUpload.mockResolvedValue({ error: null });
  mockRpc.mockImplementation(async (name, params) => {
    if (name === 'sk_profile_own') return { data: { ...server }, error: null };
    if (operations.has(params.p_operation_id))
      return { data: { ...server }, error: null };
    if (params.p_version !== server.version)
      return {
        data: null,
        error: { code: 'PT409', message: 'Version conflict' },
      };
    operations.add(params.p_operation_id);
    server = { ...server, ...params.p_payload, version: server.version + 1 };
    return { data: { ...server }, error: null };
  });
});
it('durably retains a normalized operation before saving with explicit account and version', async () => {
  const d = draft();
  const result = await saveOwnProfile(actor, d);
  expect(result.firstName).toBe('Zoë');
  expect(result.version).toBe(2);
  expect(mockRpc).toHaveBeenCalledWith(
    'sk_profile_save',
    expect.objectContaining({
      p_user_id: actor,
      p_version: 1,
      p_operation_id: d.operationId,
    }),
  );
  expect(keepProfileDraft).toHaveBeenCalledWith(
    actor,
    expect.objectContaining({
      fields: expect.objectContaining({ firstName: 'Zoë' }),
    }),
  );
});
it('retains an offline draft without changing the server', async () => {
  mockRpc.mockRejectedValueOnce(Error('Offline'));
  await expect(saveOwnProfile(actor, draft())).rejects.toMatchObject({
    mayHaveCommitted: false,
  });
  expect(server.version).toBe(1);
  expect(keepProfileDraft).toHaveBeenCalled();
});
it('recovers a lost save response without reapplying or incrementing the version', async () => {
  const impl = mockRpc.getMockImplementation()!;
  let lost = false;
  const d = draft();
  mockRpc.mockImplementation(async (name, params) => {
    const result = await impl(name, params);
    if (name === 'sk_profile_save' && !lost) {
      lost = true;
      return { data: null, error: { message: 'Response lost' } };
    }
    return result;
  });
  await expect(saveOwnProfile(actor, d)).rejects.toMatchObject({
    mayHaveCommitted: true,
  });
  expect(server.version).toBe(2);
  const result = await saveOwnProfile(actor, { ...d, uncertain: true });
  expect(result.version).toBe(2);
});
it('retains uncertainty when an earlier unconfirmed save cannot be checked offline', async () => {
  mockRpc.mockRejectedValue(Error('Offline'));
  await expect(
    saveOwnProfile(actor, { ...draft(), uncertain: true }),
  ).rejects.toMatchObject({ mayHaveCommitted: true });
});
it('does not overwrite a profile changed on another device', async () => {
  const d = draft();
  server = { ...server, version: 2, displayName: 'Anderes Gerät' };
  await expect(saveOwnProfile(actor, d)).rejects.toMatchObject({
    code: 'PT409',
    mayHaveCommitted: false,
  });
  expect(server.displayName).toBe('Anderes Gerät');
});
it('does not send a profile mutation after switching accounts during upload', async () => {
  mockUpload.mockImplementation(async () => {
    useAuthStore.setState({ user: { id: other } as never });
    return { error: null };
  });
  await expect(
    saveOwnProfile(actor, {
      ...draft(),
      photoUri: 'local.jpg',
      fields: { ...draft().fields, avatarKind: 'photo' },
    }),
  ).rejects.toThrow('Konto');
  expect(mockRpc.mock.calls.some(([name]) => name === 'sk_profile_save')).toBe(
    false,
  );
  expect(server.version).toBe(1);
});
it('keeps the confirmed profile unchanged after a failed image upload', async () => {
  mockUpload.mockRejectedValueOnce(Error('Upload failed'));
  await expect(
    saveOwnProfile(actor, {
      ...draft(),
      photoUri: 'local.jpg',
      fields: { ...draft().fields, avatarKind: 'photo' },
    }),
  ).rejects.toThrow('Upload failed');
  expect(server.avatarKind).toBe('none');
  expect(mockRpc.mock.calls.some(([name]) => name === 'sk_profile_save')).toBe(
    false,
  );
});
it('rejects a foreign profile response', async () => {
  mockRpc.mockResolvedValueOnce({
    data: { ...server, id: other },
    error: null,
  });
  await expect(readOwnProfile(actor)).rejects.toThrow(
    'Ungültige Profilantwort',
  );
});
