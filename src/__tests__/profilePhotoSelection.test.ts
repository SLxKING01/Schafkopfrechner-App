import { Platform } from 'react-native';

import {
  profilePhotoBytes,
  selectProfilePhoto,
} from '../services/profile/profilePhoto';
import { useAuthStore } from '../store/authStore';
const mockPick = jest.fn(),
  mockSave = jest.fn(),
  mockCrop = jest.fn(),
  mockResize = jest.fn();
const mockFiles = new Map<string, Uint8Array>();
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockPick(...args),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      crop: mockCrop,
      resize: mockResize,
      renderAsync: async () => ({
        width: 600,
        height: 400,
        saveAsync: mockSave,
      }),
    }),
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///documents/' } },
  File: class {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((p) => (typeof p === 'string' ? p : p.uri))
        .join('/');
    }
    get name() {
      return this.uri.split('/').at(-1)!;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    async arrayBuffer() {
      const bytes = mockFiles.get(this.uri);
      if (!bytes) throw Error('Missing file');
      return bytes.buffer;
    }
    async write(bytes: Uint8Array) {
      mockFiles.set(this.uri, bytes);
    }
  },
}));
const actor = '00000000-0000-4000-8000-000000000001';
const image = [
  0xff, 0xd8, 0xff, 0xe1, 0, 6, 69, 88, 73, 70, 0xff, 0xda, 0, 2, 8, 9, 0xff,
  0xd9,
];
beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.clear();
  jest.replaceProperty(Platform, 'OS', 'ios');
  useAuthStore.setState({ user: { id: actor } as never });
  mockPick.mockResolvedValue({
    canceled: false,
    assets: [
      { uri: 'file:///source.jpg', width: 600, height: 400, fileSize: 100 },
    ],
  });
  mockFiles.set('file:///encoded.jpg', Uint8Array.from(image));
  mockSave.mockResolvedValue({ uri: 'file:///encoded.jpg' });
});
afterEach(() => jest.restoreAllMocks());
it('reads rendered native photo bytes from the filesystem without browser base64 APIs', async () => {
  const uri = await selectProfilePhoto(actor);
  expect(uri).toContain(`profile-${actor}-`);
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({ base64: false }),
  );
  expect(mockCrop).toHaveBeenCalledWith({
    originX: 100,
    originY: 0,
    width: 400,
    height: 400,
  });
  expect([...new Uint8Array(await profilePhotoBytes(uri!))]).toEqual([
    0xff, 0xd8, 0xff, 0xda, 0, 2, 8, 9, 0xff, 0xd9,
  ]);
});
it('does not write native files after cancellation or account switch during selection', async () => {
  mockPick.mockResolvedValueOnce({ canceled: true });
  expect(await selectProfilePhoto(actor)).toBeNull();
  expect(mockSave).not.toHaveBeenCalled();
  mockPick.mockImplementationOnce(async () => {
    useAuthStore.setState({ user: { id: 'other' } as never });
    return { canceled: false, assets: [] };
  });
  await expect(selectProfilePhoto(actor)).rejects.toThrow('Konto');
  expect(mockSave).not.toHaveBeenCalled();
});
it('rejects oversized originals before decoding', async () => {
  mockPick.mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        uri: 'file:///source.jpg',
        width: 100,
        height: 100,
        fileSize: 21 * 1024 * 1024,
      },
    ],
  });
  await expect(selectProfilePhoto(actor)).rejects.toThrow('20 MB');
  expect(mockSave).not.toHaveBeenCalled();
});
