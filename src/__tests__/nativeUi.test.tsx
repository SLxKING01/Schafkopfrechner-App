import { act } from 'react';
import { TextInput, View } from 'react-native';

import { AuthInput } from '../components/auth/AuthInput';

const renderer = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: jest.requireActual('react-native').View },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: () => ({}),
  withTiming: (value: number) => value,
}));
const Icon = () => <View />;

it('exposes a named password toggle and preserves the entered password when showing and hiding it', async () => {
  const onChangeText = jest.fn();
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <AuthInput
        icon={Icon}
        isPassword
        accessibilityLabel="Passwort"
        value="mein-passwort"
        onChangeText={onChangeText}
      />,
    );
  });
  const toggle = (name: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: name })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  expect(view.root.findByType(TextInput).props.secureTextEntry).toBe(true);
  await act(async () => toggle('Passwort anzeigen').props.onPress());
  expect(view.root.findByType(TextInput).props.secureTextEntry).toBe(false);
  expect(view.root.findByType(TextInput).props.value).toBe('mein-passwort');
  await act(async () => toggle('Passwort verbergen').props.onPress());
  expect(view.root.findByType(TextInput).props.secureTextEntry).toBe(true);
  expect(onChangeText).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});
