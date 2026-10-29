import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react';
import { ScrollView } from 'react-native';

import { RoundEntrySheet } from '../components/game/RoundEntrySheet';
import { reliableStorage } from '../storage/reliableStorage';
import { useGameStore } from '../store/gameStore';
import type { GameRound } from '../types/game';
import { formatRoundGameType } from '../utils/cardSuits';
import { emptyTariffOptions } from '../utils/roundTariff';

const renderer = jest.requireActual('react-test-renderer');
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const native = jest.requireActual('react-native');
  return {
    BottomSheetScrollView: native.ScrollView,
    BottomSheetTextInput: native.TextInput,
  };
});
jest.mock('../components/ui/InteractionSheet', () => ({
  InteractionSheet: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? children : null),
}));
jest.mock('../components/auth/GoldButton', () => ({
  GoldButton: (props: { title: string; accessibilityLabel?: string }) => {
    const React = jest.requireActual('react');
    const native = jest.requireActual('react-native');
    return React.createElement(
      native.Pressable,
      { ...props, accessibilityLabel: props.accessibilityLabel ?? props.title },
      React.createElement(native.Text, null, props.title),
    );
  },
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, {
    get: (target, key) =>
      key === 'Modal'
        ? ({
            visible,
            children,
          }: {
            visible: boolean;
            children: React.ReactNode;
          }) => (visible ? children : null)
        : target[key],
  });
});
const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id.toUpperCase(),
  isLocal: true,
}));
let sequence = 0;
beforeEach(async () => {
  await reliableStorage.flush();
  useGameStore.setState({
    currentTable: null,
    activeGame: false,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
  });
  useGameStore.getState().createTable('Eingabetest', players);
  const tableSettings = structuredClone(
    useGameStore.getState().currentTable!.settings,
  );
  tableSettings.games.wenz.enabled = true;
  useGameStore.getState().updateCurrentTableSettings(tableSettings);
  useGameStore.setState({
    currentTable: {
      ...useGameStore.getState().currentTable!,
      id: `entry-${++sequence}`,
    },
  });
  await reliableStorage.flush();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await reliableStorage.retryWrites();
  await reliableStorage.flush();
});
async function mount(editingRound: GameRound | null = null, roster = players) {
  const onSaved = jest.fn();
  const onClose = jest.fn();
  const props = {
    table: useGameStore.getState().currentTable,
    players: roster,
    editingRound,
    visible: true,
    onClose,
    onDismiss: jest.fn(),
    onSaved,
  };
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<RoundEntrySheet {...props} />);
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  return {
    view: view!,
    props,
    button,
    onSaved,
    onClose,
    press: async (label: string) => {
      await act(async () => button(label).props.onPress());
    },
  };
}
function addPartnerRound() {
  useGameStore.getState().addRound({
    gameType: 'rufspiel',
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    amount: 0.4,
    declarerId: 'a',
    partnerId: 'b',
    tariffOptions: { ...emptyTariffOptions },
  });
  return useGameStore.getState().rounds[0];
}
it('keeps full player names and independent coin/result actions available at large system font sizes', async () => {
  jest
    .spyOn(jest.requireActual('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 2 });
  const roster = players.map((player) => ({
    ...player,
    name: `Alexandra mit sehr langem Namen ${player.id}`,
  }));
  const ui = await mount(null, roster);
  await ui.press('Spieltyp Wenz');
  await ui.press(`Alleinspieler ${roster[0].name}`);
  const names = ui.view.root.findAllByProps({ children: roster[0].name });
  expect(names.length).toBeGreaterThan(0);
  expect(
    names.every(
      (node: { props: { numberOfLines?: number } }) =>
        node.props.numberOfLines !== 1,
    ),
  ).toBe(true);
  await ui.press(`Klopfen ${roster[1].name}`);
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    amount: 3,
    winnerId: 'a',
    tariffOptions: { legerCount: 1 },
  });
  await act(async () => ui.view.unmount());
});
it('uses independent coin buttons to add and undo knocking during entry and saves the resulting tariff', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Wenz');
  await ui.press('Alleinspieler C');
  await ui.press('Klopfen A');
  expect(ui.button('Klopfen A').props.accessibilityState.selected).toBe(true);
  expect(ui.button('Alleinspieler C').props.accessibilityState.selected).toBe(
    true,
  );
  await ui.press('Klopfen A');
  expect(ui.button('Klopfen A').props.accessibilityState.selected).toBe(false);
  await ui.press('Klopfen A');
  await ui.press('Klopfen B');
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    amount: 6,
    winnerIds: ['c'],
    tariffOptions: { legerCount: 2 },
    roundContext: { legerPlayerIds: ['a', 'b'] },
  });
  expect(useGameStore.getState().currentTable!.placedLegerPlayerIds).toEqual(
    [],
  );
  await act(async () => ui.view.unmount());
});

it('corrects knocking on a saved round without consuming the next-round coins or changing the dealer', async () => {
  const original = addPartnerRound();
  useGameStore.getState().togglePlayerLeger('d');
  const before = useGameStore.getState().currentTable!;
  const ui = await mount(original);
  await ui.press('Klopfen A');
  await ui.press('Korrektur speichern');
  const corrected = useGameStore.getState().rounds[0];
  expect(corrected).toMatchObject({
    id: original.id,
    amount: 0.8,
    tariffOptions: { legerCount: 1 },
    roundContext: { legerPlayerIds: ['a'] },
  });
  expect(useGameStore.getState().currentTable).toMatchObject({
    dealerId: before.dealerId,
    placedLegerPlayerIds: ['d'],
  });
  expect(useGameStore.getState().balances.map(({ amount }) => amount)).toEqual([
    0.4, 0.4, -0.4, -0.4,
  ]);
  await act(async () => ui.view.unmount());
  const reopened = await mount(corrected);
  expect(reopened.button('Klopfen A').props.accessibilityState.selected).toBe(
    true,
  );
  await reopened.press('Klopfen A');
  await reopened.press('Korrektur speichern');
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    amount: 0.4,
    tariffOptions: { legerCount: 0 },
    roundContext: { legerPlayerIds: [] },
  });
  await act(async () => reopened.view.unmount());
});
it('saves, restores and corrects a suit without changing the per-player tariff', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Wenz');
  await ui.press('Alleinspieler A');
  await ui.press('Kartenfarbe Herz');
  expect(ui.button('Kartenfarbe Herz').props.accessibilityState.selected).toBe(
    true,
  );
  await ui.press('Runde speichern');
  const round = useGameStore.getState().rounds[0];
  expect(round).toMatchObject({ gameType: 'wenz', suit: 'herz', amount: 1.5 });
  expect(formatRoundGameType(round.gameType, round.suit)).toBe('Herzwenz');
  const stored = JSON.parse(
    (await AsyncStorage.getItem('schafkopfrechner-games'))!,
  );
  expect(stored.state.rounds[0].suit).toBe('herz');
  await act(async () => ui.view.unmount());
  const correction = await mount(round);
  expect(
    correction.button('Kartenfarbe Herz').props.accessibilityState.selected,
  ).toBe(true);
  await correction.press('Kartenfarbe Schellen');
  await correction.press('Korrektur speichern');
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    id: round.id,
    suit: 'schellen',
    amount: 1.5,
  });
  await act(async () => correction.view.unmount());
});

it('deselects a suit and clears it when changing game types', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Wenz');
  await ui.press('Kartenfarbe Eichel');
  await ui.press('Kartenfarbe Eichel');
  expect(
    ui.button('Kartenfarbe Eichel').props.accessibilityState.selected,
  ).toBe(false);
  await ui.press('Kartenfarbe Gras');
  await ui.press('Spielart ändern');
  await ui.press('Spieltyp Solo');
  expect(ui.button('Kartenfarbe Gras').props.accessibilityState.selected).toBe(
    false,
  );
  await act(async () => ui.view.unmount());
});

it('keeps separate Kontra and Re controls consistent with the saved multiplier', async () => {
  const settings = structuredClone(
    useGameStore.getState().currentTable!.settings,
  );
  settings.bonusRules.stoss.enabled = false;
  useGameStore.getState().updateCurrentTableSettings(settings);
  const ui = await mount();
  await ui.press('Spieltyp Wenz');
  await ui.press('Alleinspieler A');
  await ui.press('Re erhöhen');
  expect(
    useGameStore.getState().currentTable!.settings.bonusRules.stoss.enabled,
  ).toBe(true);
  const kontra = () =>
    ui.view.root
      .findAllByProps({ accessibilityLabel: 'Kontra' })
      .find(
        (node: { props: { onValueChange?: unknown } }) =>
          typeof node.props.onValueChange === 'function',
      )!;
  expect(kontra().props.value).toBe(true);
  await act(async () => kontra().props.onValueChange(false));
  expect(ui.button('Re verringern').props.disabled).toBe(true);
  await act(async () => kontra().props.onValueChange(true));
  await ui.press('Re erhöhen');
  await ui.press('Re erhöhen');
  await ui.press('Re erhöhen');
  expect(ui.button('Re erhöhen').props.disabled).toBe(true);
  await ui.press('Re verringern');
  await ui.press('Re verringern');
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    amount: 6,
    tariffOptions: { stoss: 2 },
  });
  await act(async () => ui.view.unmount());
});
it('edits Kontra and Re on an older round with disabled Stoss and keeps the original table tariffs', async () => {
  const settings = structuredClone(
    useGameStore.getState().currentTable!.settings,
  );
  settings.bonusRules.stoss.enabled = false;
  useGameStore.getState().updateCurrentTableSettings(settings);
  const original = addPartnerRound();
  addPartnerRound();
  const other = useGameStore.getState().rounds.at(-1)!;
  const ui = await mount(original);
  const headers = ui.view.root.findAllByProps({ accessibilityRole: 'header' });
  expect(
    headers.some(
      (node: { props: { children: unknown } }) =>
        node.props.children === 'Rufspiel',
    ),
  ).toBe(true);
  expect(
    headers.some((node: { props: { children: unknown } }) =>
      String(node.props.children).includes('Korrektur'),
    ),
  ).toBe(false);
  // The save action participates in the same scroll content as the final options.
  expect(
    ui.view.root
      .findByType(ScrollView)
      .findAllByProps({ accessibilityLabel: 'Korrektur speichern' }).length,
  ).toBeGreaterThan(0);
  const kontra = ui.view.root
    .findAllByProps({ accessibilityLabel: 'Kontra' })
    .find(
      (node: { props: { onValueChange?: unknown } }) =>
        typeof node.props.onValueChange === 'function',
    )!;
  await act(async () => kontra.props.onValueChange(true));
  await ui.press('Re erhöhen');
  await ui.press('Korrektur speichern');
  const corrected = useGameStore
    .getState()
    .rounds.find(({ id }) => id === original.id)!;
  expect(corrected).toMatchObject({
    amount: original.amount * 4,
    tariffOptions: { stoss: 2 },
    settingsSnapshot: { bonusRules: { stoss: { enabled: true } } },
  });
  expect(corrected.settingsSnapshot.games).toEqual(
    original.settingsSnapshot.games,
  );
  expect(
    useGameStore.getState().currentTable!.settings.bonusRules.stoss.enabled,
  ).toBe(false);
  expect(
    useGameStore.getState().rounds.find(({ id }) => id === other.id),
  ).toEqual(other);
  await act(async () => ui.view.unmount());
});
it('automatically completes two result teams without separate declarer or partner selectors', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Rufspiel');
  expect(
    ui.view.root.findAllByProps({ accessibilityLabel: 'Spieler A' }),
  ).toHaveLength(0);
  expect(
    ui.view.root.findAllByProps({ accessibilityLabel: 'Partner B' }),
  ).toHaveLength(0);
  await ui.press('A verloren');
  expect(ui.button('Runde speichern').props.disabled).toBe(true);
  await ui.press('B verloren');
  expect(ui.button('C gewonnen').props.accessibilityState.selected).toBe(true);
  expect(ui.button('D gewonnen').props.accessibilityState.selected).toBe(true);
  await ui.press('C verloren');
  expect(ui.button('Runde speichern').props.disabled).toBe(true);
  await ui.press('D verloren');
  await ui.press('Runde speichern');
  const round = useGameStore.getState().rounds[0];
  expect(round.winnerIds).toEqual(['a', 'b']);
  expect(round.loserIds).toEqual(['c', 'd']);
  expect(round.declarerId).toBeUndefined();
  expect(round.partnerId).toBeUndefined();
  expect(ui.onSaved).toHaveBeenCalledTimes(1);
  await act(async () => ui.view.unmount());
});
it('changes teams on an older round without keeping incorrect caller metadata', async () => {
  const original = addPartnerRound();
  const ui = await mount(original);
  await ui.press('C gewonnen');
  await ui.press('B gewonnen');
  await ui.press('Korrektur speichern');
  const round = useGameStore.getState().rounds[0];
  expect(round.id).toBe(original.id);
  expect(round.winnerIds).toEqual(['c', 'b']);
  expect(round.loserIds).toEqual(['a', 'd']);
  expect(round.declarerId).toBeUndefined();
  expect(round.partnerId).toBeUndefined();
  await act(async () => ui.view.unmount());
});
it('corrects an older game type using its original tariffs and immutable Leger context', async () => {
  useGameStore.getState().togglePlayerLeger('a');
  useGameStore.getState().addRound({
    gameType: 'rufspiel',
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    amount: 0.8,
    declarerId: 'a',
    partnerId: 'b',
    tariffOptions: { ...emptyTariffOptions, legerCount: 1 },
  });
  const original = useGameStore.getState().rounds[0];
  const settings = structuredClone(
    useGameStore.getState().currentTable!.settings,
  );
  settings.games.solo.value = 9;
  useGameStore.getState().updateCurrentTableSettings(settings);
  const ui = await mount(original);
  await ui.press('Spielart ändern');
  await ui.press('Spieltyp Solo');
  await ui.press('Alleinspieler C');
  await ui.press('Alleinspieler verloren');
  await ui.press('Korrektur speichern');
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    id: original.id,
    gameType: 'solo',
    amount: 3,
    winnerIds: ['a', 'b', 'd'],
    loserIds: ['c'],
    tariffOptions: { legerCount: 1 },
  });
  expect(
    useGameStore.getState().rounds[0].settingsSnapshot.games.solo.value,
  ).toBe(0.5);
  await act(async () => ui.view.unmount());
});
it.each([false, true])(
  'keeps and explicitly discards a draft consistently, correction=%s',
  async (editing) => {
    const original = editing ? addPartnerRound() : null;
    const ui = await mount(original);
    if (!editing) {
      await ui.press('Spieltyp Rufspiel');
    }
    await ui.press('A verloren');
    await ui.press('B verloren');
    await ui.press('Rundeneingabe schließen');
    expect(ui.onClose).not.toHaveBeenCalled();
    await ui.press('Entwurf behalten');
    expect(ui.onClose).toHaveBeenCalledTimes(1);
    await act(async () => ui.view.unmount());
    const reopened = await mount(original);
    expect(
      reopened.button('A verloren').props.accessibilityState.selected,
    ).toBe(true);
    await reopened.press('Rundeneingabe schließen');
    await reopened.press('Entwurf verwerfen');
    await act(async () => reopened.view.unmount());
    const blank = await mount(original);
    expect(
      blank.button(editing ? 'A gewonnen' : 'Spieltyp Rufspiel'),
    ).toBeTruthy();
    if (editing)
      expect(blank.button('A gewonnen').props.accessibilityState.selected).toBe(
        true,
      );
    expect(useGameStore.getState().rounds).toHaveLength(editing ? 1 : 0);
    await act(async () => blank.view.unmount());
  },
);
it('does not confirm a failed disk write and retries the same round without a duplicate', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Solo');
  await ui.press('Alleinspieler A');
  const originalWrite = jest
    .mocked(AsyncStorage.setItem)
    .getMockImplementation()!;
  const failure = jest
    .spyOn(AsyncStorage, 'setItem')
    .mockImplementation(async (key, value) => {
      if (key === 'schafkopfrechner-games') throw new Error('Disk full');
      return originalWrite(key, value);
    });
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds).toHaveLength(1);
  expect(ui.onSaved).not.toHaveBeenCalled();
  expect(ui.button('Erneut auf Gerät speichern')).toBeTruthy();
  failure.mockImplementation(originalWrite);
  await ui.press('Erneut auf Gerät speichern');
  expect(ui.onSaved).toHaveBeenCalledTimes(1);
  expect(useGameStore.getState().rounds).toHaveLength(1);
  const stored = JSON.parse(
    (await AsyncStorage.getItem('schafkopfrechner-games'))!,
  );
  expect(stored.state.rounds[0].id).toBe(useGameStore.getState().rounds[0].id);
  await act(async () => ui.view.unmount());
});
