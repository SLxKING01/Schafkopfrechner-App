import { act } from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';
import { G } from 'react-native-svg';

import { MatchHistoryCard } from '../components/game/MatchHistoryCard';
import { SyncStatus } from '../components/game/SyncStatus';
import { ActiveGameScreen } from '../screens/app/ActiveGameScreen';
import { CreateTableScreen } from '../screens/app/CreateTableScreen';
import { reliableStorage } from '../storage/reliableStorage';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { emptyTariffOptions } from '../utils/roundTariff';

const renderer = jest.requireActual('react-test-renderer');
const navigate = jest.fn();
jest.setTimeout(30000);
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => jest.requireActual('react-native').View }),
);
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: jest.requireActual('react-native').View,
}));
jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: jest.requireActual('react-native').View,
  BottomSheetScrollView: jest.requireActual('react-native').ScrollView,
  BottomSheetTextInput: jest.requireActual('react-native').TextInput,
}));
jest.mock('../components/auth/AuthBackground', () => ({
  AuthBackground: jest.requireActual('react-native').View,
}));
jest.mock('../components/ui/InteractionSheet', () => ({
  InteractionSheet: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? children : null),
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

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  navigate.mockClear();
  useGameStore.setState({
    archivedGameDays: [],
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
  });
  useGameStore.getState().createTable('Tisch vom 26.10.2026', [
    { id: 'a', name: 'Berkay', isLocal: true },
    { id: 'b', name: 'Flo', isLocal: true },
    { id: 'c', name: 'Simon', isLocal: true },
    { id: 'd', name: 'Andi', isLocal: true },
  ]);
});
afterEach(() => jest.restoreAllMocks());

it('opens the round selected in statistics directly in the existing editor', async () => {
  useGameStore.getState().addRound({
    gameType: 'rufspiel',
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    declarerId: 'a',
    partnerId: 'b',
    amount: 0.4,
    tariffOptions: { ...emptyTariffOptions },
  });
  const roundId = useGameStore.getState().rounds[0].id;
  const setParams = jest.fn();
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate, setParams } as never}
        route={{ params: { roundId } } as never}
      />,
    );
  });
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Korrektur speichern' })
      .length,
  ).toBeGreaterThan(0);
  expect(setParams).toHaveBeenCalledWith({ roundId: undefined });
  await act(async () => view.unmount());
});

it('opens the saved configuration by tapping the compact history row and updates the same round', async () => {
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
  const original = useGameStore.getState().rounds[0];
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  await act(async () => button('Verlauf Tab').props.onPress());
  const row = view.root.findByType(MatchHistoryCard);
  expect(row.props.compact).toBe(true);
  expect(row.props.winner).toBe('Berkay & Flo');
  await act(async () =>
    button(`Runde ${original.id} bearbeiten`).props.onPress(),
  );
  expect(button('Berkay gewonnen').props.accessibilityState.selected).toBe(
    true,
  );
  expect(button('Flo gewonnen').props.accessibilityState.selected).toBe(true);
  await act(async () =>
    view.root
      .findAllByProps({ accessibilityLabel: 'Schneider' })
      .find(
        (node: { props: { onValueChange?: unknown } }) =>
          typeof node.props.onValueChange === 'function',
      )!
      .props.onValueChange(true),
  );
  await act(async () => button('Korrektur speichern').props.onPress());
  const rounds = useGameStore.getState().rounds;
  expect(rounds).toHaveLength(1);
  expect(rounds[0]).toMatchObject({
    id: original.id,
    declarerId: 'a',
    partnerId: 'b',
    tariffOptions: { schneider: true },
  });
  expect(rounds[0].amount).toBeGreaterThan(original.amount);
  expect(
    useGameStore.getState().balances.find(({ playerId }) => playerId === 'a')
      ?.amount,
  ).toBe(rounds[0].amount / 2);
  await act(async () => view.unmount());
});

it('hides routine local and cloud save information but keeps cloud errors visible', async () => {
  jest.spyOn(reliableStorage, 'confirmWrite').mockResolvedValue(true);
  const previousUser = useAuthStore.getState().user;
  useAuthStore.setState({ user: { id: 'status-user' } as never });
  useGameStore.setState({
    syncError: null,
    syncing: false,
    isOffline: false,
    lastSyncedAt: '2026-10-29T12:00:00Z',
  });
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<SyncStatus />);
  });
  expect(view.toJSON()).toBeNull();
  await act(async () => useGameStore.setState({ syncError: 'Offline' }));
  expect(JSON.stringify(view.toJSON())).toContain(
    'Cloud-Abgleich fehlgeschlagen',
  );
  expect(JSON.stringify(view.toJSON())).not.toContain('Letzter Cloud-Abgleich');
  await act(async () => view.unmount());
  useAuthStore.setState({ user: previousUser });
  useGameStore.setState({ syncError: null });
});

it('lets all four deposit Stock and pays it to the two selected Sauspiel winners', async () => {
  const settings = structuredClone(
    useGameStore.getState().currentTable!.settings,
  );
  settings.games.stock.enabled = true;
  settings.games.stock.value = 0.5;
  useGameStore.getState().updateCurrentTableSettings(settings);
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  await act(async () => button('Spiel eintragen').props.onPress());
  await act(async () => button('Spieltyp Stock').props.onPress());
  expect(
    view.root.findAllByProps({
      accessibilityLabel: 'Berkay als Gewinner auswählen',
    }),
  ).toHaveLength(0);
  expect(button('Runde speichern').props.disabled).toBe(false);
  await act(async () => button('Runde speichern').props.onPress());
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    stockAction: 'deposit',
    amount: 2,
  });
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Stock: 2,00 €' }).length,
  ).toBeGreaterThan(0);
  await act(async () => button('Spiel eintragen').props.onPress());
  await act(async () => button('Spieltyp Rufspiel').props.onPress());
  await act(async () => button('Berkay gewonnen').props.onPress());
  const stockSwitch = () =>
    view.root
      .findAllByProps({ accessibilityLabel: 'Stock auszahlen' })
      .find(
        (node: { props: { onValueChange?: unknown } }) =>
          typeof node.props.onValueChange === 'function',
      )!;
  expect(stockSwitch().props.disabled).toBe(true);
  await act(async () => button('Flo gewonnen').props.onPress());
  expect(stockSwitch().props.disabled).toBe(false);
  await act(async () =>
    view.root
      .findAllByProps({ accessibilityLabel: 'Stock auszahlen' })
      .find(
        (node: { props: { onValueChange?: unknown } }) =>
          typeof node.props.onValueChange === 'function',
      )!
      .props.onValueChange(true),
  );
  await act(async () => button('Runde speichern').props.onPress());
  expect(useGameStore.getState().rounds[1].stockAction).toBe('payout');
  expect(useGameStore.getState().rounds[1].winnerIds).toEqual(['a', 'b']);
  expect(useGameStore.getState().rounds[1].declarerId).toBeUndefined();
  expect(useGameStore.getState().rounds[1].partnerId).toBeUndefined();
  expect(
    useGameStore.getState().balances.map((balance) => balance.amount),
  ).toEqual([0.7, 0.7, -0.7, -0.7]);
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Stock: 0,00 €' }).length,
  ).toBeGreaterThan(0);
  await act(async () => view.unmount());
});

it.each(['refund', 'carry'] as const)(
  'offers a funded Stock resolution and opens the original table settlement for %s',
  async (resolution) => {
    const settings = structuredClone(
      useGameStore.getState().currentTable!.settings,
    );
    settings.games.stock.enabled = true;
    useGameStore.getState().updateCurrentTableSettings(settings);
    useGameStore.getState().addRound({
      winnerId: '',
      winnerIds: [],
      loserIds: ['a', 'b', 'c', 'd'],
      amount: 2,
      gameType: 'stock',
      stockAction: 'deposit',
    });
    const originalId = useGameStore.getState().currentTable!.id;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let view: ReturnType<typeof renderer.create>;
    await act(async () => {
      view = renderer.create(
        <ActiveGameScreen
          navigation={{ navigate } as never}
          route={{} as never}
        />,
      );
    });
    await act(async () =>
      view.root
        .findAllByProps({ accessibilityLabel: 'Spieltag abschliessen' })
        .find(
          (node: { props: { onPress?: unknown } }) =>
            typeof node.props.onPress === 'function',
        )!
        .props.onPress(),
    );
    expect(useGameStore.getState().activeGame).toBe(true);
    const actions = alert.mock.calls.at(-1)![2]!;
    expect(actions.map(({ text }) => text)).toEqual([
      'Abbrechen',
      'Stock zurückgeben',
      'Stock übernehmen',
    ]);
    await act(async () =>
      actions.find(
        ({ text }) =>
          text ===
          (resolution === 'refund' ? 'Stock zurückgeben' : 'Stock übernehmen'),
      )!.onPress!(),
    );
    expect(navigate).toHaveBeenCalledWith('Settlement', {
      tableId: originalId,
    });
    expect(useGameStore.getState().activeGame).toBe(resolution === 'carry');
    await act(async () => view.unmount());
  },
);

it('records Ramsch with a Jungfrau and restricts its bonus controls', async () => {
  const settings = structuredClone(
    useGameStore.getState().currentTable!.settings,
  );
  settings.games.ramsch.enabled = true;
  useGameStore.getState().updateCurrentTableSettings(settings);
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  await act(async () => button('Spiel eintragen').props.onPress());
  await act(async () => button('Spieltyp Ramsch').props.onPress());
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Laufende erhöhen' }),
  ).toHaveLength(0);
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Schneider' }),
  ).toHaveLength(0);
  await act(async () => button('Ramsch-Verlierer Andi').props.onPress());
  await act(async () => button('Jungfrauen erhöhen').props.onPress());
  await act(async () => button('Runde speichern').props.onPress());
  expect(useGameStore.getState().rounds[0]).toMatchObject({
    gameType: 'ramsch',
    amount: 1.2,
    tariffOptions: { jungfrauen: 1 },
  });
  expect(useGameStore.getState().balances.map(({ amount }) => amount)).toEqual([
    0.4, 0.4, 0.4, -1.2,
  ]);
  await act(async () => view.unmount());
});

it('allows one Leger per player and combines four players into a 16x factor', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  const kpi = (factor: number) =>
    expect(
      view.root.findAllByProps({
        accessibilityLabel: `Gesamtmultiplikator: ${factor}x`,
      }).length,
    ).toBeGreaterThan(0);
  kpi(1);
  expect(
    view.root
      .findAllByType(G)
      .filter(
        (node: { props: { testID?: string } }) =>
          node.props.testID === 'dealer-acorn',
      ),
  ).toHaveLength(1);
  expect(
    view.root
      .findAllByType(G)
      .filter(
        (node: { props: { testID?: string } }) =>
          node.props.testID === 'covered-cards',
      ),
  ).toHaveLength(3);
  for (const [name, factor] of [
    ['Berkay', 2],
    ['Flo', 4],
    ['Simon', 8],
    ['Andi', 16],
  ] as const) {
    await act(async () => button(`Leger ${name}: 1x`).props.onPress());
    expect(button(`Leger ${name}: 2x`)).toBeTruthy();
    kpi(factor);
  }
  // A second tap removes a player's contribution instead of doubling it again.
  await act(async () => button('Leger Berkay: 2x').props.onPress());
  expect(button('Leger Berkay: 1x')).toBeTruthy();
  kpi(8);
  for (const name of ['Flo', 'Simon', 'Andi']) {
    await act(async () => button(`Leger ${name}: 2x`).props.onPress());
  }
  kpi(1);
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => button('Leger Berkay: 1x').props.onPress());
  await act(async () => button('Spiel eintragen').props.onPress());
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Spieltyp Wenz' }),
  ).toHaveLength(0);
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Runde speichern' }),
  ).toHaveLength(0);
  await act(async () => button('Spieltyp Rufspiel').props.onPress());
  expect(
    view.root
      .findAllByType(jest.requireActual('react-native').Text)
      .some((node: { props: { children: unknown } }) =>
        JSON.stringify(node.props.children).includes('Gesamtfaktor'),
      ),
  ).toBe(true);
  await act(async () => button('Berkay gewonnen').props.onPress());
  await act(async () => button('Simon gewonnen').props.onPress());
  await act(async () => button('Runde speichern').props.onPress());
  expect(useGameStore.getState().rounds).toHaveLength(1);
  expect(useGameStore.getState().rounds[0].amount).toBe(0.8);
  expect(button('Leger Berkay: 1x')).toBeTruthy();
  kpi(1);
  expect(
    view.root
      .findAllByType(G)
      .filter(
        (node: { props: { testID?: string } }) =>
          node.props.testID === 'dealer-acorn',
      ),
  ).toHaveLength(1);
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Flo, -0,40 €, Geber' })
      .length,
  ).toBeGreaterThan(0);
  await act(async () => view.unmount());
});

it('keeps table settings reachable through the menu', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  await act(async () => button('Tischmenü öffnen').props.onPress());
  await act(async () => button('Tisch bearbeiten').props.onPress());
  expect(navigate).toHaveBeenCalledWith('EditTable');
  await act(async () => view.unmount());
});

it('edits seats without changing the current dealer and cancels draft changes', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  await act(async () => button('Sitzreihenfolge ändern').props.onPress());
  await act(async () => button('Flo nach unten').props.onPress());
  await act(async () => button('Reihenfolge speichern').props.onPress());
  expect(useGameStore.getState().players.map(({ name }) => name)).toEqual([
    'Berkay',
    'Simon',
    'Flo',
    'Andi',
  ]);
  expect(useGameStore.getState().currentTable?.dealerId).toBe('a');
  await act(async () => button('Sitzreihenfolge ändern').props.onPress());
  await act(async () => button('Simon nach unten').props.onPress());
  await act(async () => button('Reihenfolge abbrechen').props.onPress());
  expect(useGameStore.getState().players.map(({ name }) => name)).toEqual([
    'Berkay',
    'Simon',
    'Flo',
    'Andi',
  ]);
  await act(async () => view.unmount());
});

it('opens explicit seat editing on a held name without disabling player scrolling', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  const name = button('Berkay, 0,00 €, Geber');
  await act(async () => name.props.onLongPress());
  expect(useGameStore.getState().players.map(({ id }) => id)).toEqual([
    'a',
    'b',
    'c',
    'd',
  ]);
  await act(async () => button('Berkay nach unten').props.onPress());
  await act(async () => button('Reihenfolge speichern').props.onPress());
  expect(useGameStore.getState().players.map(({ id }) => id)).toEqual([
    'b',
    'a',
    'c',
    'd',
  ]);
  expect(useGameStore.getState().currentTable?.dealerId).toBe('a');
  expect(
    view.root.findByProps({ testID: 'player-standings-list' }).props
      .scrollEnabled,
  ).toBe(true);
  await act(async () => button('Leger Berkay: 1x').props.onPress());
  expect(useGameStore.getState().currentTable?.placedLegerPlayerIds).toEqual([
    'a',
  ]);
  await act(async () => view.unmount());
});

it('keeps the native player list bounded and restores its scroll position across tabs', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const list = view.root.findByProps({ testID: 'player-standings-list' });
  expect(StyleSheet.flatten(list.props.style).flex).toBe(1);
  expect(list.props.scrollEnabled).toBe(true);
  expect(list.props.data).toHaveLength(4);
  await act(async () =>
    list.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 120 } } }),
  );
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  await act(async () => button('Verlauf Tab').props.onPress());
  await act(async () => button('Spieler Tab').props.onPress());
  expect(
    view.root.findByProps({ testID: 'player-standings-list' }).props
      .contentOffset,
  ).toEqual({ x: 0, y: 120 });
  await act(async () => view.unmount());
});

it.each([false, true])(
  'closes table creation safely with a back history of %s',
  async (hasHistory) => {
    const goBack = jest.fn();
    const navigation = { navigate, canGoBack: () => hasHistory, goBack };
    let view: ReturnType<typeof renderer.create>;
    await act(async () => {
      view = renderer.create(
        <CreateTableScreen
          navigation={navigation as never}
          route={{} as never}
        />,
      );
    });
    for (const label of ['Runde erstellen schließen', 'Abbrechen']) {
      const button = view.root
        .findAllByProps({ accessibilityLabel: label })
        .find(
          (node: { props: { onPress?: unknown } }) =>
            typeof node.props.onPress === 'function',
        )!;
      await act(async () => button.props.onPress());
    }
    if (hasHistory) {
      expect(goBack).toHaveBeenCalledTimes(2);
      expect(navigate).not.toHaveBeenCalled();
    } else {
      expect(goBack).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('AppTabs', { screen: 'GameLobby' });
    }
    await act(async () => view.unmount());
  },
);

it.each([false, true])(
  'applies Turbo Ramsch to saved amounts, with Leger=%s',
  async (withLeger) => {
    let view: ReturnType<typeof renderer.create>;
    await act(async () => {
      view = renderer.create(
        <ActiveGameScreen
          navigation={{ navigate } as never}
          route={{} as never}
        />,
      );
    });
    const button = (label: string) =>
      view.root
        .findAllByProps({ accessibilityLabel: label })
        .find(
          (node: { props: { onPress?: unknown } }) =>
            typeof node.props.onPress === 'function',
        )!;
    const turboSwitch = () =>
      view.root
        .findAllByProps({ accessibilityLabel: 'Turbo Ramsch' })
        .find(
          (node: { props: { onValueChange?: unknown } }) =>
            typeof node.props.onValueChange === 'function',
        )!;
    expect(turboSwitch().props.value).toBe(false);
    if (withLeger)
      await act(async () => button('Leger Berkay: 1x').props.onPress());
    await act(async () => turboSwitch().props.onValueChange(true));
    expect(useGameStore.getState().currentTable?.turboRamschEnabled).toBe(true);
    expect(
      view.root.findAllByProps({
        accessibilityLabel: `Gesamtmultiplikator: ${withLeger ? 4 : 2}x`,
      }).length,
    ).toBeGreaterThan(0);
    await act(async () => turboSwitch().props.onValueChange(false));
    expect(
      view.root.findAllByProps({
        accessibilityLabel: `Gesamtmultiplikator: ${withLeger ? 2 : 1}x`,
      }).length,
    ).toBeGreaterThan(0);
    await act(async () => turboSwitch().props.onValueChange(true));
    await act(async () => button('Spiel eintragen').props.onPress());
    expect(
      view.root.findAllByProps({ accessibilityLabel: 'Spieltyp Wenz' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ accessibilityLabel: 'Runde speichern' }),
    ).toHaveLength(0);
    await act(async () => button('Spieltyp Rufspiel').props.onPress());
    await act(async () => button('Berkay gewonnen').props.onPress());
    await act(async () => button('Simon gewonnen').props.onPress());
    await act(async () => button('Runde speichern').props.onPress());
    expect(useGameStore.getState().rounds[0].amount).toBe(
      withLeger ? 1.6 : 0.8,
    );
    expect(useGameStore.getState().currentTable?.turboRamschEnabled).toBe(true);
    await act(async () => view.unmount());
  },
);

it('opens the exact newly closed table rather than a previously viewed archive', async () => {
  const tableId = useGameStore.getState().currentTable!.id;
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = view.root
    .findAllByProps({ accessibilityLabel: 'Spieltag abschliessen' })
    .find(
      (node: { props: { onPress?: unknown } }) =>
        typeof node.props.onPress === 'function',
    )!;
  await act(async () => button.props.onPress());
  expect(navigate).toHaveBeenCalledWith('Settlement', { tableId });
  expect(
    useGameStore
      .getState()
      .archivedGameDays.some(({ table }) => table.id === tableId),
  ).toBe(true);
  await act(async () => view.unmount());
});

it.each(['web', 'ios'] as const)(
  'keeps Leger when the table screen is reopened on %s',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    let view: ReturnType<typeof renderer.create>;
    const render = () => (
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />
    );
    await act(async () => {
      view = renderer.create(render());
    });
    const coin = view.root
      .findAllByProps({ accessibilityLabel: 'Leger Berkay: 1x' })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
    await act(async () => coin.props.onPress());
    await act(async () => view.unmount());
    await act(async () => {
      view = renderer.create(render());
    });
    expect(
      view.root.findAllByProps({ accessibilityLabel: 'Leger Berkay: 2x' })
        .length,
    ).toBeGreaterThan(0);
    expect(
      view.root.findAllByProps({
        accessibilityLabel: 'Gesamtmultiplikator: 2x',
      }).length,
    ).toBeGreaterThan(0);
    await act(async () => view.unmount());
  },
);

it('calculates a selected Solo with configured bonuses and saves its three opponent shares', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <ActiveGameScreen
        navigation={{ navigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  await act(async () => button('Spiel eintragen').props.onPress());
  await act(async () => button('Spieltyp Solo').props.onPress());
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Gesamtgewinn manuell' }),
  ).toHaveLength(0);
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Kontra / Re erhöhen' }),
  ).toHaveLength(0);
  expect(button('Runde speichern').props.disabled).toBe(true);
  await act(async () => button('Alleinspieler Berkay').props.onPress());
  expect(button('Runde speichern').props.disabled).toBe(false);
  await act(async () => button('Laufende erhöhen').props.onPress());
  await act(async () =>
    view.root
      .findAllByProps({ accessibilityLabel: 'Schwarz' })
      .find(
        (node: { props: { onValueChange?: unknown } }) =>
          typeof node.props.onValueChange === 'function',
      )!
      .props.onValueChange(true),
  );
  await act(async () => button('Runde speichern').props.onPress());
  const round = useGameStore.getState().rounds[0];
  // (Solo 0.50 + Laufende 0.30 + Schneider 0.10 + Schwarz 0.10) * 3.
  expect(round.amount).toBe(3);
  expect(round.gameType).toBe('solo');
  expect(round.tariffOptions).toMatchObject({ laufende: 3, schwarz: true });
  expect(
    useGameStore.getState().balances.map((balance) => balance.amount),
  ).toEqual([3, -1, -1, -1]);
  await act(async () => view.unmount());
});
