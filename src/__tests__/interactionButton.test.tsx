import { act } from 'react';
import { StyleSheet, View } from 'react-native';

import { GoldButton } from '../components/auth/GoldButton';

const renderer = jest.requireActual('react-test-renderer');
let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: jest.requireActual('react-native').View },
  useReducedMotion: () => mockReducedMotion,
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: () => ({}),
  withSpring: (value: number) => value,
}));

it.each([false, true])(
  'keeps press feedback with reduced motion set to %s',
  async (reduceMotion) => {
    mockReducedMotion = reduceMotion;
    let view: ReturnType<typeof renderer.create>;
    await act(async () => {
      view = renderer.create(<GoldButton title="Weiter" onPress={jest.fn()} />);
    });
    const button = view.root.findByProps({ accessibilityLabel: 'Weiter' });
    await act(async () => button.props.onPressIn());
    const style = StyleSheet.flatten(
      view.root.findAllByType(View)[0].props.style,
    );
    expect(style.opacity).toBe(0.88);
    expect(style.transform).toEqual([{ scale: reduceMotion ? 1 : 0.985 }]);
    expect(style.transitionDuration).toBe(reduceMotion ? 0 : 120);
    await act(async () => button.props.onPressOut());
    expect(
      StyleSheet.flatten(view.root.findAllByType(View)[0].props.style)
        .transform,
    ).toEqual([{ scale: 1 }]);
    await act(async () => view.unmount());
    mockReducedMotion = false;
  },
);

it('blocks interaction while loading even when disabled was not supplied', async () => {
  const onPress = jest.fn();
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <GoldButton title="Speichern" loading onPress={onPress} />,
    );
  });
  expect(
    view.root.findByProps({ accessibilityLabel: 'Speichern' }).props.disabled,
  ).toBe(true);
  await act(async () => {
    view.update(<GoldButton title="Speichern" onPress={onPress} />);
  });
  expect(
    view.root.findByProps({ accessibilityLabel: 'Speichern' }).props.disabled,
  ).toBe(false);
  await act(async () => view.unmount());
});
