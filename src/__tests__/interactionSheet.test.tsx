import { act } from 'react';
import { KeyboardAvoidingView, Text } from 'react-native';

import { InteractionSheet } from '../components/ui/InteractionSheet';

const renderer = jest.requireActual('react-test-renderer');
const mockClose = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, {
    get: (target, key) => (key === 'Modal' ? target.View : target[key]),
  });
});

it('uses a bounded keyboard-aware native modal for full-screen forms without a competing sheet scroller', async () => {
  const onClose = jest.fn();
  const onDismiss = jest.fn();
  let view: ReturnType<typeof renderer.create>;
  const render = (visible: boolean, dismissible = true) => (
    <InteractionSheet
      fullScreen
      visible={visible}
      dismissible={dismissible}
      onClose={onClose}
      onDismiss={onDismiss}
    >
      <Text>Spiel</Text>
    </InteractionSheet>
  );
  await act(async () => {
    view = renderer.create(render(true, false));
  });
  expect(view.root.findAllByProps({ testID: 'sheet' })).toHaveLength(0);
  expect(view.root.findByType(KeyboardAvoidingView).props.style).toMatchObject({
    flex: 1,
  });
  await act(async () =>
    view.root.findByProps({ animationType: 'none' }).props.onRequestClose(),
  );
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => view.update(render(true)));
  await act(async () =>
    view.root.findByProps({ animationType: 'none' }).props.onRequestClose(),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => view.update(render(false)));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  await act(async () => view.unmount());
});
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react');
  const View = jest.requireActual('react-native').View;
  return {
    __esModule: true,
    default: React.forwardRef(function MockSheet(props: object, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ close: mockClose }));
      return React.createElement(View, { ...props, testID: 'sheet' });
    }),
    BottomSheetBackdrop: View,
  };
});
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 12, right: 18 }),
}));

it('finishes closing before unmounting and reports gesture dismissal', async () => {
  const onClose = jest.fn();
  const onDismiss = jest.fn();
  const render = (visible: boolean) => (
    <InteractionSheet visible={visible} onClose={onClose} onDismiss={onDismiss}>
      <Text>Entwurf</Text>
    </InteractionSheet>
  );
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(render(true));
  });
  expect(
    view.root.findByProps({ testID: 'sheet' }).props.containerStyle,
  ).toMatchObject({ marginLeft: 12, marginRight: 18 });
  await act(async () => {
    view.update(render(false));
  });
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(view.root.findByProps({ testID: 'sheet' })).toBeTruthy();
  await act(async () => {
    view.root.findByProps({ testID: 'sheet' }).props.onClose();
  });
  expect(view.root.findAllByProps({ testID: 'sheet' })).toHaveLength(0);
  expect(onClose).not.toHaveBeenCalled();
  expect(onDismiss).toHaveBeenCalledTimes(1);

  await act(async () => {
    view.update(render(true));
  });
  await act(async () => {
    view.root.findByProps({ testID: 'sheet' }).props.onClose();
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledTimes(2);
  await act(async () => view.unmount());
});
