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
async function mount(
  editingRound: GameRound | null = null,
  roster = players,
  initialDeclarerId?: string,
) {
  const onSaved = jest.fn();
  const onClose = jest.fn();
  const props = {
    initialDeclarerId,
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
  await ui.press('Ansager gewonnen');
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
  await ui.press('Ansager gewonnen');
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
  await ui.press('Ansager gewonnen');
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
  await ui.press('Ansager gewonnen');
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
it('completes two result teams and stores the explicitly chosen caller and partner', async () => {
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
  await ui.press('Ansager A');
  await ui.press('Runde speichern');
  const round = useGameStore.getState().rounds[0];
  expect(round.winnerIds).toEqual(['a', 'b']);
  expect(round.loserIds).toEqual(['c', 'd']);
  expect(round.declarerId).toBe('a');
  expect(round.partnerId).toBe('b');
  expect(ui.onSaved).toHaveBeenCalledTimes(1);
  await act(async () => ui.view.unmount());
});
it('preserves the caller independently of the result and updates the partner when teams change', async () => {
  const original = addPartnerRound();
  const ui = await mount(original);
  await ui.press('C gewonnen');
  await ui.press('B gewonnen');
  await ui.press('Korrektur speichern');
  const round = useGameStore.getState().rounds[0];
  expect(round.id).toBe(original.id);
  expect(round.winnerIds).toEqual(['c', 'b']);
  expect(round.loserIds).toEqual(['a', 'd']);
  expect(round.declarerId).toBe('a');
  expect(round.partnerId).toBe('d');
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
  await ui.press('Ansager gewonnen');
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
it('retains a draft on disk and keeps the dialog open when writing fails', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Rufspiel');
  await ui.press('A verloren');
  await ui.press('Rundeneingabe schließen');
  const originalWrite = jest
    .mocked(AsyncStorage.setItem)
    .getMockImplementation()!;
  const write = jest
    .spyOn(AsyncStorage, 'setItem')
    .mockRejectedValueOnce(new Error('disk full'));
  await ui.press('Entwurf behalten');
  expect(ui.onClose).not.toHaveBeenCalled();
  expect(JSON.stringify(ui.view.toJSON())).toContain(
    'Der Entwurf konnte nicht',
  );
  write.mockImplementation(originalWrite);
  await ui.press('Entwurf behalten');
  const key = `schafkopfrechner-round-draft-v1:guest:${ui.props.table!.id}:new`;
  expect(JSON.parse((await AsyncStorage.getItem(key))!).draft.losers).toContain(
    'a',
  );
  await act(async () => ui.view.unmount());
  const reopened = await mount();
  expect(reopened.button('A verloren').props.accessibilityState.selected).toBe(
    true,
  );
  await reopened.press('Rundeneingabe schließen');
  await reopened.press('Entwurf verwerfen');
  expect(await AsyncStorage.getItem(key)).toBeNull();
  await act(async () => reopened.view.unmount());
});
it('does not restore a new-round draft after another round changes its context', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Rufspiel');
  await ui.press('A verloren');
  await ui.press('Rundeneingabe schließen');
  await ui.press('Entwurf behalten');
  await act(async () => ui.view.unmount());
  addPartnerRound();
  const reopened = await mount();
  expect(reopened.button('Spieltyp Rufspiel')).toBeTruthy();
  await act(async () => reopened.view.unmount());
});
it('does not confirm a failed disk write and retries the same round without a duplicate', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Solo');
  await ui.press('Alleinspieler A');
  await ui.press('Ansager gewonnen');
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

it.each(['Solo', 'Wenz'])(
  'preselects the tapped caller for %s without selecting a win and saves a lost game with that ID',
  async (type) => {
    const ui = await mount(null, players, 'b');
    expect(
      ui.view.root.findAll(
        (node: { props: { children?: unknown } }) =>
          Array.isArray(node.props.children) &&
          node.props.children.join('') === 'Ansager: B',
      ).length,
    ).toBeGreaterThan(0);
    await ui.press(`Spieltyp ${type}`);
    expect(ui.button('Ansager B').props.accessibilityState.selected).toBe(true);
    expect(
      ui.button('Ansager gewonnen').props.accessibilityState.selected,
    ).toBe(false);
    expect(
      ui.button('Ansager verloren').props.accessibilityState.selected,
    ).toBe(false);
    expect(ui.button('Runde speichern').props.disabled).toBe(true);
    await ui.press('Ansager verloren');
    await ui.press('Runde speichern');
    const round = useGameStore.getState().rounds[0];
    expect(round).toMatchObject({
      declarerId: 'b',
      loserIds: ['b'],
      winnerIds: ['a', 'c', 'd'],
    });
    expect(round.partnerId).toBeUndefined();
    const stored = JSON.parse(
      (await AsyncStorage.getItem('schafkopfrechner-games'))!,
    );
    expect(stored.state.rounds[0].declarerId).toBe('b');
    await act(async () => ui.view.unmount());
    const edit = await mount(round);
    expect(edit.button('Ansager B').props.accessibilityState.selected).toBe(
      true,
    );
    expect(
      edit.button('Ansager verloren').props.accessibilityState.selected,
    ).toBe(true);
    await edit.press('Ansager C');
    await edit.press('Korrektur speichern');
    expect(useGameStore.getState().rounds).toHaveLength(1);
    expect(useGameStore.getState().rounds[0]).toMatchObject({
      id: round.id,
      declarerId: 'c',
      loserIds: ['c'],
    });
    await act(async () => edit.view.unmount());
  },
);
it('explicitly records caller and partner for a lost Sauspiel and retains them through archiving', async () => {
  const ui = await mount(null, players, 'c');
  await ui.press('Spieltyp Rufspiel');
  expect(ui.button('Ansager C').props.accessibilityState.selected).toBe(true);
  await ui.press('Partner D');
  expect(ui.button('Runde speichern').props.disabled).toBe(true);
  await ui.press('Ansager verloren');
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    declarerId: 'c',
    partnerId: 'd',
    loserIds: ['c', 'd'],
    winnerIds: ['a', 'b'],
  });
  await act(async () => ui.view.unmount());
  expect(useGameStore.getState().finishGameDay()).toBe(true);
  expect(useGameStore.getState().archivedGameDays[0].rounds[0]).toMatchObject({
    declarerId: 'c',
    partnerId: 'd',
  });
});
it('cancels an untouched preselected entry without creating or altering games', async () => {
  const before = structuredClone(useGameStore.getState().currentTable);
  const ui = await mount(null, players, 'd');
  await ui.press('Rundeneingabe schließen');
  expect(ui.onClose).toHaveBeenCalledTimes(1);
  expect(useGameStore.getState().rounds).toEqual([]);
  expect(useGameStore.getState().currentTable).toEqual(before);
  await act(async () => ui.view.unmount());
});
it('keeps retained quick-entry drafts separate for different tapped callers', async () => {
  const first = await mount(null, players, 'a');
  await first.press('Spieltyp Solo');
  await first.press('Ansager verloren');
  await first.press('Rundeneingabe schließen');
  await first.press('Entwurf behalten');
  await act(async () => first.view.unmount());
  const second = await mount(null, players, 'b');
  await second.press('Spieltyp Solo');
  expect(second.button('Ansager B').props.accessibilityState.selected).toBe(
    true,
  );
  expect(
    second.button('Ansager verloren').props.accessibilityState.selected,
  ).toBe(false);
  await act(async () => second.view.unmount());
  const restored = await mount(null, players, 'a');
  expect(restored.button('Ansager A').props.accessibilityState.selected).toBe(
    true,
  );
  expect(
    restored.button('Ansager verloren').props.accessibilityState.selected,
  ).toBe(true);
  await act(async () => restored.view.unmount());
});
it('keeps legacy unknown callers unknown when correcting only the tariff', async () => {
  useGameStore.getState().addRound({
    gameType: 'rufspiel',
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    amount: 0.4,
    tariffOptions: { ...emptyTariffOptions },
  });
  const original = useGameStore.getState().rounds[0];
  const ui = await mount(original);
  expect(ui.button('Ansager A').props.accessibilityState.selected).toBe(false);
  await ui.press('Korrektur speichern');
  expect(useGameStore.getState().rounds[0].declarerId).toBeUndefined();
  await act(async () => ui.view.unmount());
});

async function setOwnAmount(
  ui: Awaited<ReturnType<typeof mount>>,
  name: string,
  value: string,
) {
  const input = ui.view.root
    .findAllByProps({ accessibilityLabel: `Betrag für ${name}` })
    .find(
      (node: { props: { onChangeText?: unknown } }) =>
        typeof node.props.onChangeText === 'function',
    )!;
  await act(async () => input.props.onChangeText(value));
}
it('offers own bookkeeping without enabled tariffs, rejects an unequal sum and saves exact signed amounts', async () => {
  const settings = structuredClone(
    useGameStore.getState().currentTable!.settings,
  );
  for (const game of Object.values(settings.games)) game.enabled = false;
  expect(useGameStore.getState().updateCurrentTableSettings(settings)).toBe(
    true,
  );
  useGameStore.getState().togglePlayerLeger('b');
  useGameStore.getState().setTurboRamsch(true);
  const before = structuredClone(useGameStore.getState().currentTable);
  const ui = await mount(null, players, 'a');
  await ui.press('Spieltyp Eigenes Spiel');
  expect(
    ui.view.root.findAllByProps({ accessibilityLabel: 'Ansager A' }),
  ).toHaveLength(0);
  expect(
    ui.view.root.findAllByProps({ accessibilityLabel: 'Kontra' }),
  ).toHaveLength(0);
  expect(ui.button('Runde speichern').props.disabled).toBe(true);
  await setOwnAmount(ui, 'A', '5,00');
  await ui.press('B Minus');
  await setOwnAmount(ui, 'B', '3,00');
  await ui.press('C Minus');
  await setOwnAmount(ui, 'C', '1,00');
  expect(ui.button('Runde speichern').props.disabled).toBe(true);
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds).toHaveLength(0);
  await setOwnAmount(ui, 'C', '2,00');
  expect(ui.button('Runde speichern').props.disabled).toBe(false);
  await ui.press('Runde speichern');
  const round = useGameStore.getState().rounds[0];
  expect(round).toMatchObject({
    gameType: 'custom',
    winnerId: '',
    winnerIds: [],
    loserIds: [],
    customAmounts: [
      { playerId: 'a', amount: 5 },
      { playerId: 'b', amount: -3 },
      { playerId: 'c', amount: -2 },
      { playerId: 'd', amount: 0 },
    ],
  });
  expect(round.declarerId).toBeUndefined();
  expect(useGameStore.getState().currentTable).toEqual(before);
  await act(async () => ui.view.unmount());
  const edit = await mount(round);
  expect(edit.button('B Minus').props.accessibilityState.selected).toBe(true);
  await setOwnAmount(edit, 'B', '2,99');
  await setOwnAmount(edit, 'C', '2,01');
  await edit.press('Korrektur speichern');
  expect(useGameStore.getState().rounds).toHaveLength(1);
  expect(useGameStore.getState().rounds[0].id).toBe(round.id);
  expect(useGameStore.getState().balances.map((p) => p.amount)).toEqual([
    5, -2.99, -2.01, 0,
  ]);
  await act(async () => edit.view.unmount());
});
it('restores an own-game draft from storage and discards it without a booking', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Eigenes Spiel');
  await setOwnAmount(ui, 'A', '4,50');
  await ui.press('B Minus');
  await setOwnAmount(ui, 'B', '4,50');
  await ui.press('Rundeneingabe schließen');
  await ui.press('Entwurf behalten');
  await act(async () => ui.view.unmount());
  const restored = await mount();
  expect(restored.button('B Minus').props.accessibilityState.selected).toBe(
    true,
  );
  expect(
    restored.view.root
      .findAllByProps({ accessibilityLabel: 'Betrag für A' })
      .some((n: { props: { value?: string } }) => n.props.value === '4,50'),
  ).toBe(true);
  await restored.press('Rundeneingabe schließen');
  await restored.press('Entwurf verwerfen');
  expect(useGameStore.getState().rounds).toHaveLength(0);
  await act(async () => restored.view.unmount());
});
it('keeps own-game invalid fields editable without changing any balance', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Eigenes Spiel');
  await setOwnAmount(ui, 'A', '1,');
  expect(ui.button('Runde speichern').props.disabled).toBe(true);
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds).toHaveLength(0);
  expect(useGameStore.getState().balances.every((p) => p.amount === 0)).toBe(
    true,
  );
  await act(async () => ui.view.unmount());
});

it('limits caller, partner and knocking choices to the four participating players at a five-player table', async () => {
  useGameStore.getState().addPlayer('E');
  const roster = useGameStore.getState().players;
  const ui = await mount(null, roster);
  await ui.press('Spieltyp Rufspiel');
  expect(ui.button('Ansager A')).toBeUndefined();
  expect(ui.button('Ansager B')).toBeTruthy();
  await ui.press('Ansager B');
  expect(ui.button('Partner A')).toBeUndefined();
  await ui.press('Partner C');
  await ui.press('Ansager gewonnen');
  expect(ui.button('Runde speichern').props.disabled).toBe(false);
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds[0].participantIds).not.toContain('a');
  expect(useGameStore.getState().rounds[0].participantIds).toHaveLength(4);
  await act(async () => ui.view.unmount());
});
it('keeps an open entry from silently recording a changed roster', async () => {
  const ui = await mount();
  await ui.press('Spieltyp Wenz');
  await ui.press('Alleinspieler A');
  await ui.press('Ansager gewonnen');
  await act(async () =>
    useGameStore
      .getState()
      .setPlayerPaused(useGameStore.getState().currentTable!.id, 'd', true),
  );
  await ui.press('Runde speichern');
  expect(useGameStore.getState().rounds).toHaveLength(0);
  expect(JSON.stringify(ui.view.toJSON())).toContain(
    'Die Besetzung oder Sitzordnung hat sich ge�ndert',
  );
  expect(ui.onSaved).not.toHaveBeenCalled();
  await act(async () => ui.view.unmount());
});
