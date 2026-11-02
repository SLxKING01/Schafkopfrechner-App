import { act } from 'react';
import { Image, Platform } from 'react-native';

import { SettlementShare } from '../components/game/SettlementShare';
import { createDefaultTableSettings } from '../constants/tableSettings';
import {
  captureSettlementImage,
  releaseSettlementImage,
  shareSettlementImage,
} from '../services/game/settlementImage';
import type { GameTable } from '../types/game';

const renderer = jest.requireActual('react-test-renderer');
jest.mock('../services/game/settlementImage', () => ({
  captureSettlementImage: jest.fn(),
  releaseSettlementImage: jest.fn(async () => {}),
  shareSettlementImage: jest.fn(async () => {}),
}));
jest.mock('../components/auth/GoldButton', () => ({
  GoldButton: ({ title, ...props }: { title: string }) => {
    const React = jest.requireActual('react');
    return React.createElement(jest.requireActual('react-native').Pressable, {
      ...props,
      accessibilityLabel: title,
    });
  },
}));
const table: GameTable = {
  id: 'table',
  hashCode: 'secret',
  name: 'Testabend',
  isActive: false,
  createdAt: '2026-11-01T18:00:00Z',
  settings: createDefaultTableSettings(),
};
const props = {
  table,
  players: [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Ben', isLocal: true },
  ],
  balances: [
    { playerId: 'a', amount: 5 },
    { playerId: 'b', amount: -5 },
  ],
  settlements: [
    { id: 'p', fromPlayerId: 'b', toPlayerId: 'a', amount: 5, isPaid: false },
  ],
  completedAt: '2026-11-01T20:00:00Z',
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(captureSettlementImage).mockResolvedValue('file:///preview.png');
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 1;
  });
});
afterEach(() => jest.restoreAllMocks());

async function mount() {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<SettlementShare {...props} />);
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (n: { props: { onPress?: unknown } }) =>
          typeof n.props.onPress === 'function',
      )!;
  const press = async (label: string) => {
    await act(async () => button(label).props.onPress());
  };
  const layout = async () => {
    await act(async () =>
      view.root
        .findAllByProps({ testID: 'settlement-export-content' })[0]
        .props.onLayout({
          nativeEvent: { layout: { width: 320, height: 1200 } },
        }),
    );
  };
  return { view: view!, button, press, layout };
}

it('shows the complete generated PNG for review and shares only after a separate press; closing releases it', async () => {
  const ui = await mount();
  await ui.press('Abrechnung teilen');
  expect(shareSettlementImage).not.toHaveBeenCalled();
  expect(ui.button('Bild teilen').props.disabled).toBe(true);
  await ui.layout();
  expect(captureSettlementImage).toHaveBeenCalledWith(expect.anything(), {
    width: 320,
    height: 1200,
  });
  expect(ui.view.root.findByType(Image).props.source.uri).toBe(
    'file:///preview.png',
  );
  expect(ui.button('Bild teilen').props.disabled).toBe(false);
  await ui.press('Bild teilen');
  expect(shareSettlementImage).toHaveBeenCalledWith('file:///preview.png');
  await ui.press('Vorschau schließen');
  expect(releaseSettlementImage).toHaveBeenCalledWith('file:///preview.png');
  await act(async () => ui.view.unmount());
});

it('recovers from generation and sharing errors without modifying the settlement', async () => {
  jest
    .mocked(captureSettlementImage)
    .mockRejectedValueOnce(new Error('capture failed'));
  const ui = await mount();
  await ui.press('Abrechnung teilen');
  await ui.layout();
  expect(JSON.stringify(ui.view.toJSON())).toContain(
    'Bild konnte nicht erstellt',
  );
  await ui.press('Bild erneut erstellen');
  expect(ui.view.root.findByType(Image)).toBeDefined();
  jest
    .mocked(shareSettlementImage)
    .mockRejectedValueOnce(new Error('Teilen fehlgeschlagen'));
  await ui.press('Bild teilen');
  expect(JSON.stringify(ui.view.toJSON())).toContain('Teilen fehlgeschlagen');
  await ui.press('Bild teilen');
  expect(shareSettlementImage).toHaveBeenCalledTimes(2);
  expect(props.settlements[0].isPaid).toBe(false);
  await act(async () => ui.view.unmount());
});

it('invalidates a preview when payment status changes and offers a fresh snapshot', async () => {
  const ui = await mount();
  await ui.press('Abrechnung teilen');
  await ui.layout();
  await act(async () =>
    ui.view.update(
      <SettlementShare
        {...props}
        settlements={props.settlements.map((p) => ({ ...p, isPaid: true }))}
      />,
    ),
  );
  expect(ui.view.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(ui.view.toJSON())).toContain(
    'Abrechnung hat sich geändert',
  );
  expect(shareSettlementImage).not.toHaveBeenCalled();
  await ui.press('Abrechnung teilen');
  expect(JSON.stringify(ui.view.toJSON())).toContain('Alles ausgeglichen');
  await act(async () => ui.view.unmount());
});

it('uses an explicit download action on web and hides export for active tables', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const ui = await mount();
  await ui.press('Abrechnung teilen');
  await ui.layout();
  await ui.press('Bild herunterladen');
  expect(shareSettlementImage).toHaveBeenCalledTimes(1);
  await act(async () =>
    ui.view.update(
      <SettlementShare {...props} table={{ ...table, isActive: true }} />,
    ),
  );
  expect(ui.view.toJSON()).toBeNull();
  await act(async () => ui.view.unmount());
});

it('discards and releases a capture that finishes after the preview was closed', async () => {
  let finishCapture!: (uri: string) => void;
  jest.mocked(captureSettlementImage).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCapture = resolve;
      }),
  );
  const ui = await mount();
  await ui.press('Abrechnung teilen');
  await ui.layout();
  await ui.press('Vorschau schließen');
  await act(async () => finishCapture('file:///late.png'));
  expect(releaseSettlementImage).toHaveBeenCalledWith('file:///late.png');
  expect(shareSettlementImage).not.toHaveBeenCalled();
  await act(async () => ui.view.unmount());
});

it('prevents a double tap from opening two share sheets and keeps the preview for cancellation or another share', async () => {
  let finishSharing!: () => void;
  jest.mocked(shareSettlementImage).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishSharing = resolve;
      }),
  );
  const ui = await mount();
  await ui.press('Abrechnung teilen');
  await ui.layout();
  await act(async () => {
    ui.button('Bild teilen').props.onPress();
    ui.button('Bild teilen').props.onPress();
  });
  expect(shareSettlementImage).toHaveBeenCalledTimes(1);
  expect(ui.button('Vorschau schließen').props.disabled).toBe(true);
  await act(async () => finishSharing());
  expect(ui.button('Bild teilen').props.disabled).toBe(false);
  expect(ui.view.root.findByType(Image)).toBeDefined();
  expect(props.settlements[0].isPaid).toBe(false);
  await act(async () => ui.view.unmount());
});
