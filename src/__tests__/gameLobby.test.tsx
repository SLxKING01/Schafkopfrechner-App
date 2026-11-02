import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react';
import { FlatList, Platform } from 'react-native';

import { GoldButton } from '../components/auth/GoldButton';
import { MatchHistoryCard } from '../components/game/MatchHistoryCard';
import { SettlementCard } from '../components/game/SettlementCard';
import { GameLobbyScreen } from '../screens/app/GameLobbyScreen';
import { SettlementScreen } from '../screens/app/SettlementScreen';
import { reliableStorage } from '../storage/reliableStorage';
import { useGameStore } from '../store/gameStore';
import { seedLegacyRound } from '../testUtils/seedLegacyRound';

const renderer = jest.requireActual('react-test-renderer');
const mockNavigate = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, {
    get: (target, key) => (key === 'Modal' ? target.View : target[key]),
  });
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
jest.mock('lucide-react-native', () => {
  const View = jest.requireActual('react-native').View;
  return {
    Bell: View,
    Handshake: View,
    ChevronRight: View,
    Copy: View,
    GripVertical: View,
    Heart: View,
    Leaf: View,
    LogOut: View,
    Nut: View,
    Pencil: View,
    Pin: View,
    Plus: View,
    Settings: View,
    Spade: View,
    ArrowRight: View,
  };
});
jest.mock('expo-blur', () => ({
  BlurView: jest.requireActual('react-native').View,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: jest.requireActual('react-native').View,
}));
jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock(
  'react-native-gesture-handler/ReanimatedSwipeable',
  () => jest.requireActual('react-native').View,
);
jest.mock(
  'react-native-draggable-flatlist',
  () => jest.requireActual('react-native').FlatList,
);
jest.mock('../components/auth/AuthBackground', () => ({
  AuthBackground: jest.requireActual('react-native').View,
}));

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  mockNavigate.mockClear();
  useGameStore.setState({
    archivedGameDays: [],
    currentTable: null,
    players: [],
    rounds: [],
    settlements: [],
    balances: [],
    activeGame: false,
    tableOrderIds: [],
  });
});
afterEach(() => jest.restoreAllMocks());

it('opens a real table on the web', async () => {
  useGameStore.getState().createTable('Testtisch', [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Max', isLocal: true },
  ]);
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<GameLobbyScreen />);
  });
  await act(async () => {
    view.root
      .findByProps({ accessibilityLabel: 'Testtisch oeffnen' })
      .props.onPress();
  });
  expect(mockNavigate).toHaveBeenCalledWith('ActiveGame');
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Am Tisch weiterspielen' }),
  ).toHaveLength(0);
  expect(
    view.root.findAllByProps({ title: 'Am Tisch weiterspielen' }),
  ).toHaveLength(0);
  await act(async () => view.unmount());
});

it('opens settlement for a finished table instead of ignoring its click', async () => {
  useGameStore.getState().createTable('Abendtisch', [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Max', isLocal: true },
  ]);
  useGameStore.getState().finishGameDay();
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<GameLobbyScreen />);
  });
  await act(async () => {
    view.root
      .findByProps({ accessibilityLabel: 'Abendtisch oeffnen' })
      .props.onPress();
  });
  expect(mockNavigate).toHaveBeenCalledWith('Settlement', {
    tableId: useGameStore.getState().currentTable!.id,
  });
  await act(async () => view.unmount());
});

it('shows an empty state instead of nonfunctional example tables', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<GameLobbyScreen />);
  });
  expect(view.root.findByProps({ title: 'Noch kein Tisch' })).toBeTruthy();
  expect(view.root.findByType(FlatList).props.data).toEqual([]);
  await act(async () => view.unmount());
});

it.each([false, true])(
  'opens working settings instead of a placeholder, active table=%s',
  async (active) => {
    if (active)
      useGameStore.getState().createTable('Regeltest', [
        { id: 'a', name: 'Anna', isLocal: true },
        { id: 'b', name: 'Max', isLocal: true },
      ]);
    let view: ReturnType<typeof renderer.create>;
    await act(async () => {
      view = renderer.create(<GameLobbyScreen />);
    });
    const label = active
      ? 'Tischregeln bearbeiten'
      : 'Profil und Einstellungen öffnen';
    const button = view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
    await act(async () => button.props.onPress());
    if (active) expect(mockNavigate).toHaveBeenCalledWith('EditTable');
    else
      expect(mockNavigate).toHaveBeenCalledWith('AppTabs', {
        screen: 'Profile',
      });
    await act(async () => view.unmount());
  },
);

it.each(['web', 'ios'] as const)(
  'keeps a new empty table visible after leaving on %s',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    useGameStore.getState().createTable('Neuer Tisch', [
      { id: 'a', name: 'Anna', isLocal: true },
      { id: 'b', name: 'Max', isLocal: true },
    ]);
    let view: ReturnType<typeof renderer.create>;
    await act(async () => {
      view = renderer.create(<GameLobbyScreen />);
    });
    const table = view.root.findByType(FlatList).props.data[0];
    expect(table.name).toBe('Neuer Tisch');
    expect(useGameStore.getState().rounds).toHaveLength(0);
    const card = view.root.findAll(
      (node: { props: { table?: { id: string }; onLeave?: unknown } }) =>
        node.props.table?.id === table.id &&
        typeof node.props.onLeave === 'function',
    )[0];
    await act(async () => card.props.onLeave(table));
    const dialog = view.root.findAll(
      (node: { props: { visible?: boolean; onConfirm?: unknown } }) =>
        node.props.visible === true &&
        typeof node.props.onConfirm === 'function',
    )[0];
    await act(async () => dialog.props.onConfirm());
    expect(
      view.root
        .findByType(FlatList)
        .props.data.map((item: { id: string }) => item.id),
    ).toContain(table.id);
    expect(useGameStore.getState().activeGame).toBe(true);
    await act(async () =>
      view.root
        .findByProps({ accessibilityLabel: 'Neuer Tisch oeffnen' })
        .props.onPress(),
    );
    expect(mockNavigate).toHaveBeenCalledWith('ActiveGame');
    await act(async () => view.unmount());
  },
);

it('opens an archived evening alongside a new table and updates only its payments', async () => {
  const oldPlayers = [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Max', isLocal: true },
  ];
  useGameStore.getState().createTable('Archivabend', oldPlayers);
  seedLegacyRound({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 12.3,
    gameType: 'rufspiel',
  });
  useGameStore.getState().finishGameDay();
  const archived = useGameStore.getState().archivedGameDays[0];
  useGameStore.getState().createTable(
    'Aktiver Abend',
    oldPlayers.map((player) => ({ ...player, name: `Neu ${player.name}` })),
  );
  const current = useGameStore.getState().currentTable;
  let lobby: ReturnType<typeof renderer.create>;
  await act(async () => {
    lobby = renderer.create(<GameLobbyScreen />);
  });
  expect(lobby.root.findByType(FlatList).props.data).toHaveLength(2);
  await act(async () =>
    lobby.root
      .findByProps({ accessibilityLabel: 'Archivabend oeffnen' })
      .props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('Settlement', {
    tableId: archived.table.id,
  });
  await act(async () => lobby.unmount());
  let detail: ReturnType<typeof renderer.create>;
  await act(async () => {
    detail = renderer.create(
      <SettlementScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { tableId: archived.table.id } } as never}
      />,
    );
  });
  expect(detail.root.findByType(MatchHistoryCard).props).toMatchObject({
    winner: 'Anna',
    losers: 'Max',
    amount: '12,30 €',
  });
  expect(detail.root.findByType(SettlementCard).props).toMatchObject({
    from: 'Max',
    to: 'Anna',
    isPaid: false,
  });
  await act(async () =>
    detail.root.findByType(SettlementCard).props.onMarkPaid(),
  );
  expect(detail.root.findByType(SettlementCard).props.isPaid).toBe(true);
  expect(useGameStore.getState().currentTable).toEqual(current);
  expect(useGameStore.getState().rounds).toEqual([]);
  await act(async () => detail.unmount());
});

it('starts creating a new table without clearing the completed evening on cancel', async () => {
  useGameStore.getState().createTable('Behalten', [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Max', isLocal: true },
  ]);
  seedLegacyRound({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 10,
    gameType: 'solo',
  });
  useGameStore.getState().finishGameDay();
  const current = useGameStore.getState().currentTable;
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <SettlementScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{} as never}
      />,
    );
  });
  const button = view.root
    .findAllByProps({ accessibilityLabel: 'Neuen Tisch starten' })
    .find(
      (node: { props: { onPress?: unknown } }) =>
        typeof node.props.onPress === 'function',
    )!;
  await act(async () => button.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('CreateTable');
  expect(useGameStore.getState().currentTable).toEqual(current);
  expect(useGameStore.getState().archivedGameDays[0].rounds).toHaveLength(1);
  await act(async () => view.unmount());
});

it('puts the saved payment plan first and expands end balances without rebuilding payments', async () => {
  useGameStore.getState().createTable('Abrechnungsprüfung', [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Simon', isLocal: true },
  ]);
  seedLegacyRound({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 5,
    gameType: 'rufspiel',
  });
  useGameStore.getState().finishGameDay();
  const saved = structuredClone(useGameStore.getState().archivedGameDays[0]);
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <SettlementScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { tableId: saved.table.id } } as never}
      />,
    );
  });
  expect(JSON.stringify(view.toJSON())).toContain('1 Zahlung zum Ausgleichen');
  const disclosure = () =>
    view.root.findByProps({ accessibilityLabel: 'Endstände anzeigen' });
  expect(disclosure().props.accessibilityState.expanded).toBe(false);
  await act(async () => disclosure().props.onPress());
  expect(disclosure().props.accessibilityState.expanded).toBe(true);
  expect(JSON.stringify(view.toJSON())).toContain('+');
  await act(async () =>
    view.root.findByType(SettlementCard).props.onMarkPaid(),
  );
  expect(JSON.stringify(view.toJSON())).toContain('Keine Zahlungen offen');
  expect(useGameStore.getState().archivedGameDays[0].settlements).toEqual(
    saved.settlements.map((p) => ({ ...p, isPaid: true })),
  );
  await act(async () => view.unmount());
});

async function mountInterim() {
  useGameStore.getState().createTable('Laufender Abend', [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Simon', isLocal: true },
  ]);
  seedLegacyRound({
    gameType: 'rufspiel',
    winnerId: 'a',
    loserIds: ['b'],
    amount: 10,
  });
  await reliableStorage.flush();
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <SettlementScreen
        navigation={{ navigate: mockNavigate } as never}
        route={
          {
            params: { tableId: useGameStore.getState().currentTable!.id },
          } as never
        }
      />,
    );
  });
  const press = async (title: string) => {
    const node = view.root
      .findAllByType(GoldButton)
      .find((n: { props: { title: string } }) => n.props.title === title)!;
    await act(async () => node.props.onPress());
  };
  return { view: view!, press };
}
it('records partial and full payments through the live table without closing or deleting games', async () => {
  const ui = await mountInterim();
  const label = 'Simon an Anna: Zwischenzahlung erfassen';
  await act(async () =>
    ui.view.root.findByProps({ accessibilityLabel: label }).props.onPress(),
  );
  await act(async () =>
    ui.view.root
      .findByProps({ accessibilityLabel: 'Bereits bezahlter Betrag' })
      .props.onChangeText('6,00'),
  );
  await ui.press('Zwischenzahlung speichern');
  expect(useGameStore.getState().settlements[0].amount).toBe(4);
  await ui.press('Alles ausgleichen');
  expect(useGameStore.getState().currentTable!.interimPayments).toHaveLength(1);
  await ui.press('Alle Zahlungen als bezahlt erfassen');
  expect(useGameStore.getState().settlements).toEqual([]);
  expect(useGameStore.getState().activeGame).toBe(true);
  expect(useGameStore.getState().rounds).toHaveLength(1);
  expect(useGameStore.getState().currentTable!.interimPayments).toHaveLength(2);
  await act(async () => ui.view.unmount());
});
it('retries a failed payment write without registering another payment', async () => {
  const ui = await mountInterim();
  await act(async () =>
    ui.view.root
      .findByProps({
        accessibilityLabel: 'Simon an Anna: Zwischenzahlung erfassen',
      })
      .props.onPress(),
  );
  const originalWrite = jest
    .mocked(AsyncStorage.setItem)
    .getMockImplementation()!;
  const failure = jest
    .spyOn(AsyncStorage, 'setItem')
    .mockImplementation(async (key, value) => {
      if (key === 'schafkopfrechner-games') throw new Error('disk full');
      return originalWrite(key, value);
    });
  await ui.press('Zwischenzahlung speichern');
  expect(JSON.stringify(ui.view.toJSON())).toContain(
    'noch nicht auf dem Gerät gesichert',
  );
  expect(useGameStore.getState().currentTable!.interimPayments).toHaveLength(1);
  failure.mockImplementation(originalWrite);
  await ui.press('Erneut auf Gerät sichern');
  expect(useGameStore.getState().currentTable!.interimPayments).toHaveLength(1);
  expect(
    JSON.parse((await AsyncStorage.getItem('schafkopfrechner-games'))!).state
      .currentTable.interimPayments,
  ).toHaveLength(1);
  await act(async () => ui.view.unmount());
});
