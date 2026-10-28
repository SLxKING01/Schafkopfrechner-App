import { act, useState } from 'react';
import { Switch } from 'react-native';

import { TableSettingsEditor } from '../components/game/TableSettingsEditor';
import {
  createDefaultTableSettings,
  gameRuleDefinitions,
  getGameRules,
} from '../constants/tableSettings';

const renderer = jest.requireActual('react-test-renderer');
jest.setTimeout(30000);
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, {
    get: (target, key) => (key === 'Modal' ? target.View : target[key]),
  });
});

it('configures a game bonus separately from the global tariff', async () => {
  let observed = createDefaultTableSettings();
  observed.games.bettel.enabled = true;
  function Editor() {
    const [settings, setSettings] = useState(observed);
    return (
      <TableSettingsEditor
        settings={settings}
        onChange={(next) => {
          observed = next;
          setSettings(next);
        }}
      />
    );
  }
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<Editor />);
  });
  await act(async () =>
    view.root
      .findAllByProps({ accessibilityLabel: 'Hausregeln Bettel' })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!
      .props.onPress(),
  );
  const toggle = view.root
    .findAllByProps({ accessibilityLabel: 'bettel: Schneider erlauben' })
    .find(
      (node: { props: { onValueChange?: unknown } }) =>
        typeof node.props.onValueChange === 'function',
    )!;
  expect(toggle.props.value).toBe(false);
  await act(async () => toggle.props.onValueChange(true));
  expect(getGameRules(observed, 'bettel').bonuses.schneider).toBe(true);
  expect(observed.bonusRules.schneider.value).toBe(0.1);
  expect(getGameRules(observed, 'rufspiel').laufendeMin).toBe(3);
  await act(async () => view.unmount());
});
jest.mock('lucide-react-native', () => {
  const View = jest.requireActual('react-native').View;
  return { Info: View, Minus: View, Plus: View, X: View };
});

it('uses the agreed tariffs and includes Ramsch among the base games', () => {
  const settings = createDefaultTableSettings();
  for (const [id, entry] of Object.entries(settings.games)) {
    expect(entry.value).toBe(['rufspiel', 'ramsch'].includes(id) ? 0.2 : 0.5);
  }
  expect(gameRuleDefinitions.find(({ id }) => id === 'ramsch')?.section).toBe(
    'base',
  );
  for (const id of ['laufende', 'schneider', 'schwarz'] as const) {
    expect(settings.bonusRules[id].value).toBe(0.1);
  }
  expect(settings.bonusRules.stoss.value).toBe(2);
  expect(settings.bonusRules.leger.value).toBe(2);
});

it('steps tariffs by ten cents, stops at zero, and preserves tariffs when toggled', async () => {
  function Editor() {
    const [settings, setSettings] = useState(createDefaultTableSettings);
    return <TableSettingsEditor settings={settings} onChange={setSettings} />;
  }
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<Editor />);
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  const amount = (value: string) =>
    view.root.findByProps({ accessibilityLabel: `Rufspiel: ${value} Euro` });
  for (const value of ['0,30', '0,40', '0,50']) {
    await act(async () =>
      button('Rufspiel: Tarif um 0,10 € erhöhen').props.onPress(),
    );
    expect(amount(value)).toBeTruthy();
  }
  for (let i = 0; i < 5; i++) {
    await act(async () =>
      button('Rufspiel: Tarif um 0,10 € senken').props.onPress(),
    );
  }
  expect(amount('0,00')).toBeTruthy();
  expect(button('Rufspiel: Tarif um 0,10 € senken').props.disabled).toBe(true);
  await act(async () =>
    button('Rufspiel: Tarif um 0,10 € erhöhen').props.onPress(),
  );
  const toggle = () =>
    view.root
      .findAllByType(Switch)
      .find(
        (node: { props: { accessibilityLabel?: string } }) =>
          node.props.accessibilityLabel === 'Rufspiel aktivieren',
      )!;
  await act(async () => toggle().props.onValueChange(false));
  expect(button('Rufspiel: Tarif um 0,10 € erhöhen').props.disabled).toBe(true);
  await act(async () => toggle().props.onValueChange(true));
  expect(amount('0,10')).toBeTruthy();
  expect(
    view.root
      .findAllByType(Switch)
      .some(
        (node: { props: { accessibilityLabel?: string } }) =>
          node.props.accessibilityLabel === 'Stoß aktivieren',
      ),
  ).toBe(true);
  expect(
    view.root
      .findAllByType(Switch)
      .some(
        (node: { props: { accessibilityLabel?: string } }) =>
          node.props.accessibilityLabel === 'Leger aktivieren',
      ),
  ).toBe(true);
  await act(async () => view.unmount());
});
