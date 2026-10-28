import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react';

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
async function mount(editingRound: GameRound | null = null) {
  const onSaved = jest.fn();
  const onClose = jest.fn();
  const props = {
    table: useGameStore.getState().currentTable,
    players,
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
it('preserves a lost result while changing either partner and highlights the selected result', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Rufspiel');
  await ui.press('Spieler A');
  await ui.press('Partner B');
  await ui.press('Spielerpartei verloren');
  await ui.press('Partner C');
  expect(
    ui.button('Spielerpartei verloren').props.accessibilityState.selected,
  ).toBe(true);
  expect(ui.button('Spielerpartei verloren').props.style).not.toEqual(
    ui.button('Spielerpartei gewonnen').props.style,
  );
  await ui.press('Spieler D');
  expect(
    ui.button('Spielerpartei verloren').props.accessibilityState.selected,
  ).toBe(true);
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    declarerId: 'd',
    partnerId: 'c',
    winnerIds: ['a', 'b'],
    loserIds: ['d', 'c'],
  });
  expect(ui.onSaved).toHaveBeenCalledTimes(1);
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
      await ui.press('Spieler A');
      await ui.press('Partner B');
    }
    await ui.press('Spielerpartei verloren');
    await ui.press('Rundeneingabe schließen');
    expect(ui.onClose).not.toHaveBeenCalled();
    await ui.press('Entwurf behalten');
    expect(ui.onClose).toHaveBeenCalledTimes(1);
    await act(async () => ui.view.unmount());
    const reopened = await mount(original);
    expect(
      reopened.button('Spielerpartei verloren').props.accessibilityState
        .selected,
    ).toBe(true);
    await reopened.press('Rundeneingabe schließen');
    await reopened.press('Entwurf verwerfen');
    await act(async () => reopened.view.unmount());
    const blank = await mount(original);
    expect(
      blank.button(editing ? 'Spielerpartei gewonnen' : 'Spieltyp Rufspiel'),
    ).toBeTruthy();
    if (editing)
      expect(
        blank.button('Spielerpartei gewonnen').props.accessibilityState
          .selected,
      ).toBe(true);
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
