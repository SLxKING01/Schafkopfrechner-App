import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import {
  captureSettlementImage,
  releaseSettlementImage,
  shareSettlementImage,
} from '../services/game/settlementImage';

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
  releaseCapture: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
beforeEach(() => jest.clearAllMocks());

it('captures the complete measured view as a double-resolution PNG and releases its temporary file', async () => {
  jest.mocked(captureRef).mockResolvedValue('file:///settlement.png');
  const target = { current: null };
  const uri = await captureSettlementImage(target, {
    width: 320,
    height: 1400,
  });
  expect(captureRef).toHaveBeenCalledWith(target, {
    format: 'png',
    result: 'tmpfile',
    width: 640,
    height: 2800,
  });
  await releaseSettlementImage(uri);
  expect(releaseCapture).toHaveBeenCalledWith(uri);
});

it('opens the native share sheet as a PNG without changing any payment status', async () => {
  jest.mocked(isAvailableAsync).mockResolvedValue(true);
  jest.mocked(shareAsync).mockResolvedValue(undefined);
  await shareSettlementImage('file:///settlement.png');
  expect(shareAsync).toHaveBeenCalledWith('file:///settlement.png', {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: 'Abrechnung teilen',
  });
});

it('reports unavailable sharing and propagates native failures so the preview can offer retry', async () => {
  jest.mocked(isAvailableAsync).mockResolvedValue(false);
  await expect(shareSettlementImage('file:///settlement.png')).rejects.toThrow(
    'nicht verfügbar',
  );
  expect(shareAsync).not.toHaveBeenCalled();
  jest.mocked(isAvailableAsync).mockResolvedValue(true);
  jest.mocked(shareAsync).mockRejectedValue(new Error('native failure'));
  await expect(shareSettlementImage('file:///settlement.png')).rejects.toThrow(
    'native failure',
  );
});
