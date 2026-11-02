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
    expect(entry.value).toBe(
      ['rufspiel', 'ramsch', 'stock'].includes(id) ? 0.2 : 0.5,
    );
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

it('offers exclusive Stock/Ramsch/off choices and an independent first stake proposal', async () => {
  let observed = createDefaultTableSettings();
  observed.games.rufspiel.value = 0.35;
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
  const press = async (label: string) =>
    act(async () =>
      view.root
        .findAllByProps({ accessibilityLabel: label })
        .find(
          (n: { props: { onPress?: unknown } }) =>
            typeof n.props.onPress === 'function',
        )!
        .props.onPress(),
    );
  const stockToggle = () =>
    view.root
      .findAllByType(Switch)
      .find(
        (node: { props: { accessibilityLabel?: string } }) =>
          node.props.accessibilityLabel === 'Stock aktivieren',
      )!;
  await act(async () => stockToggle().props.onValueChange(true));
  expect(observed.games.stock).toMatchObject({ enabled: true, value: 0.35 });
  expect(observed.games.ramsch.enabled).toBe(false);
  await press('Stock: Tarif um 0,10 € erhöhen');
  expect(observed.games.stock.value).toBe(0.45);
  expect(observed.games.rufspiel.value).toBe(0.35);
  const beforeConflict = structuredClone(observed);
  await press('Weiter-Regel Ramsch');
  expect(observed).toEqual(beforeConflict);
  expect(JSON.stringify(view.toJSON())).toContain('Deaktiviere zuerst Stock');
  await press('Verstanden');
  const ramschToggle = () =>
    view.root
      .findAllByType(Switch)
      .find(
        (node: { props: { accessibilityLabel?: string } }) =>
          node.props.accessibilityLabel === 'Ramsch aktivieren',
      )!;
  await act(async () => ramschToggle().props.onValueChange(true));
  expect(observed).toEqual(beforeConflict);
  await press('Verstanden');
  await press('Weiter-Regel Beides aus');
  await act(async () => ramschToggle().props.onValueChange(true));
  expect(observed.games.ramsch.enabled).toBe(true);
  expect(observed.games.stock.enabled).toBe(false);
  await press('Weiter-Regel Stock');
  expect(observed.games.stock.enabled).toBe(false);
  expect(observed.games.ramsch.enabled).toBe(true);
  expect(JSON.stringify(view.toJSON())).toContain('Deaktiviere zuerst Ramsch');
  await press('Verstanden');
  await act(async () => stockToggle().props.onValueChange(true));
  expect(observed.games.stock.enabled).toBe(false);
  expect(observed.games.ramsch.enabled).toBe(true);
  await press('Verstanden');
  await act(async () => ramschToggle().props.onValueChange(false));
  expect(observed.games.ramsch.enabled).toBe(false);
  await press('Weiter-Regel Ramsch');
  await press('Weiter-Regel Beides aus');
  expect(observed.games.stock.enabled).toBe(false);
  expect(observed.games.ramsch.enabled).toBe(false);
  await press('Weiter-Regel Stock');
  expect(observed.games.stock.value).toBe(0.45);
  expect(observed.games.rufspiel.enabled).toBe(true);
  expect(
    view.root
      .findAllByType(Switch)
      .filter(
        (node: { props: { accessibilityLabel?: string } }) =>
          node.props.accessibilityLabel === 'Stock aktivieren',
      ),
  ).toHaveLength(1);
  expect(
    view.root
      .findAllByType(Switch)
      .filter(
        (node: { props: { accessibilityLabel?: string } }) =>
          node.props.accessibilityLabel === 'Ramsch aktivieren',
      ),
  ).toHaveLength(1);
  await act(async () => view.unmount());
});
it('explains a funded Stock mode-switch refusal while allowing changes to future stakes', async () => {
  let observed = createDefaultTableSettings();
  observed.games.stock.enabled = true;
  observed.stockStakeConfigured = true;
  function Editor() {
    const [settings, setSettings] = useState(observed);
    return (
      <TableSettingsEditor
        stockBalanceCents={80}
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
  const press = async (label: string) =>
    act(async () =>
      view.root
        .findAllByProps({ accessibilityLabel: label })
        .find(
          (n: { props: { onPress?: unknown } }) =>
            typeof n.props.onPress === 'function',
        )!
        .props.onPress(),
    );
  await press('Weiter-Regel Ramsch');
  expect(observed.games.stock.enabled).toBe(true);
  expect(observed.games.ramsch.enabled).toBe(false);
  expect(
    view.root.findAllByProps({ accessibilityRole: 'alert' }).length,
  ).toBeGreaterThan(0);
  await press('Stock: Tarif um 0,10 € erhöhen');
  expect(observed.games.stock.value).toBe(0.3);
  await act(async () => view.unmount());
});
