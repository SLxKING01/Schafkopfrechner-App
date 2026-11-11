import { act } from 'react';
import { Alert, Platform, Text } from 'react-native';
import renderer from 'react-test-renderer';

import { AppAlertHost } from '../components/AppAlertHost';
import { appAlert, getCurrentAppAlert, resetAppAlerts } from '../lib/appAlert';

afterEach(() => {
  jest.restoreAllMocks();
  act(() => resetAppAlerts());
});

const pressLabel = (view: renderer.ReactTestRenderer, label: string) =>
  view.root
    .findAllByProps({ accessibilityLabel: label })
    .find(
      (node: { props: { onPress?: unknown } }) =>
        typeof node.props.onPress === 'function',
    )!
    .props.onPress();

it('keeps the native system alert on iOS and Android', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  appAlert('Titel', 'Text', [{ text: 'OK' }]);
  expect(alert).toHaveBeenCalledWith('Titel', 'Text', [{ text: 'OK' }]);
  expect(getCurrentAppAlert()).toBeNull();
});

it('renders web alerts in-app and runs the chosen button', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const alert = jest.spyOn(Alert, 'alert');
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  let view!: renderer.ReactTestRenderer;
  await act(async () => {
    view = renderer.create(<AppAlertHost />);
  });
  await act(async () =>
    appAlert('Spieler entfernen', 'Wirklich entfernen?', [
      { text: 'Abbrechen', style: 'cancel', onPress: onCancel },
      { text: 'Entfernen', style: 'destructive', onPress: onConfirm },
    ]),
  );
  expect(alert).not.toHaveBeenCalled();
  const texts = view.root
    .findAllByType(Text)
    .map((node: { props: { children?: unknown } }) =>
      [node.props.children].flat().join(''),
    );
  expect(texts).toEqual(
    expect.arrayContaining(['Spieler entfernen', 'Wirklich entfernen?']),
  );
  await act(async () => pressLabel(view, 'Entfernen'));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onCancel).not.toHaveBeenCalled();
  expect(getCurrentAppAlert()).toBeNull();
  await act(async () => view.unmount());
});

it('shows a single OK button by default and lets handlers chain alerts', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  let view!: renderer.ReactTestRenderer;
  await act(async () => {
    view = renderer.create(<AppAlertHost />);
  });
  await act(async () =>
    appAlert('Erst', undefined, [
      { text: 'Weiter', onPress: () => appAlert('Danach') },
    ]),
  );
  await act(async () => pressLabel(view, 'Weiter'));
  expect(getCurrentAppAlert()?.title).toBe('Danach');
  expect(getCurrentAppAlert()?.buttons).toEqual([{ text: 'OK' }]);
  await act(async () => pressLabel(view, 'OK'));
  expect(getCurrentAppAlert()).toBeNull();
  await act(async () => view.unmount());
});
