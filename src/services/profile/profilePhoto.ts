import * as crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { useAuthStore } from '../../store/authStore';
import {
  decodeBase64,
  encodeBase64,
  stripJpegMetadata,
} from '../../utils/profilePhoto';

export async function selectProfilePhoto(
  actor: string,
): Promise<string | null> {
  // Launch directly from the press handler, also on web. System photo pickers
  // need no broad photo-library permission on supported iOS/Android versions.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
    allowsMultipleSelection: false,
  });
  if (result.canceled) return null;
  if (useAuthStore.getState().user?.id !== actor)
    throw new Error('Konto hat sich geändert.');
  const asset = result.assets[0];
  const sourceSize =
    asset.fileSize ??
    asset.file?.size ??
    (Platform.OS !== 'web' ? new File(asset.uri).size : 0);
  if (sourceSize > 20 * 1024 * 1024 || asset.width * asset.height > 100_000_000)
    throw new Error('Bitte ein Foto unter 20 MB und 100 Megapixel auswählen.');
  const context = ImageManipulator.manipulate(asset.uri, {
    maxWidth: 1024,
    maxHeight: 1024,
  });
  const decoded = await context.renderAsync();
  const side = Math.min(decoded.width, decoded.height);
  const crop = ImageManipulator.manipulate(decoded);
  crop.crop({
    originX: Math.floor((decoded.width - side) / 2),
    originY: Math.floor((decoded.height - side) / 2),
    width: side,
    height: side,
  });
  crop.resize({ width: Math.min(512, side), height: Math.min(512, side) });
  const image = await crop.renderAsync();
  const encoded = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
    base64: Platform.OS === 'web',
  });
  const renderedBytes =
    Platform.OS === 'web'
      ? decodeBase64(encoded.base64!)
      : new Uint8Array(await new File(encoded.uri).arrayBuffer());
  const bytes = stripJpegMetadata(renderedBytes);
  if (bytes.byteLength > 512000)
    throw new Error(
      'Das aufbereitete Foto ist zu groß. Bitte ein anderes Foto auswählen.',
    );
  if (useAuthStore.getState().user?.id !== actor)
    throw new Error('Konto hat sich geändert.');
  if (Platform.OS === 'web')
    return `data:image/jpeg;base64,${encodeBase64(bytes)}`;
  const file = new File(
    Paths.document,
    `profile-${actor}-${crypto.randomUUID()}.jpg`,
  );
  await file.write(bytes);
  return file.uri;
}
export async function profilePhotoBytes(uri: string): Promise<ArrayBuffer> {
  const data =
    Platform.OS === 'web'
      ? decodeBase64(uri.split(',')[1] ?? '')
      : new Uint8Array(await new File(uri).arrayBuffer());
  const cleaned = stripJpegMetadata(data);
  if (cleaned.byteLength > 512000) throw new Error('Profilfoto ist zu groß.');
  return cleaned.buffer as ArrayBuffer;
}
export function removeLocalProfilePhoto(actor: string, uri?: string) {
  if (Platform.OS === 'web' || !uri) return;
  const file = new File(uri);
  if (
    uri.startsWith(Paths.document.uri) &&
    file.name.startsWith(`profile-${actor}-`) &&
    file.name.endsWith('.jpg') &&
    file.exists
  )
    file.delete();
}
