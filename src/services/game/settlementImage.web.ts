import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

export async function captureSettlementImage(
  target: RefObject<ComponentRef<typeof View> | null>,
  size: { width: number; height: number },
) {
  await document.fonts.ready;
  const { default: html2canvas } = await import('html2canvas-pro');
  const element = target.current as unknown as HTMLElement | null;
  if (!element) throw new Error('Die Bildansicht ist nicht mehr verfügbar.');
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    width: Math.ceil(size.width),
    height: Math.ceil(size.height),
  });
  return canvas.toDataURL('image/png');
}

/** A download also works in browsers without local-file Web Share support. */
export async function shareSettlementImage(uri: string) {
  const link = document.createElement('a');
  link.href = uri;
  link.download = 'schafkopf-abrechnung.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function releaseSettlementImage(_uri: string) {
  // Data URIs have no temporary file to release.
}
