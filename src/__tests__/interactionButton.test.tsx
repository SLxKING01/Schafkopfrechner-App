import { act } from 'react';

import { GoldButton } from '../components/auth/GoldButton';

const renderer = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: jest.requireActual('react-native').View },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: () => ({}),
  withSpring: (value: number) => value,
}));

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
