import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

export async function captureSettlementImage(
  target: RefObject<ComponentRef<typeof View> | null>,
  size: { width: number; height: number },
) {
  return captureRef(target, {
    format: 'png',
    result: 'tmpfile',
    width: Math.ceil(size.width * 2),
    height: Math.ceil(size.height * 2),
  });
}

export async function shareSettlementImage(uri: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(
      'Das Teilen von Bildern ist auf diesem Gerät nicht verfügbar.',
    );
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: 'Abrechnung teilen',
  });
}

export async function releaseSettlementImage(uri: string) {
  releaseCapture(uri);
}
