import { act } from 'react';
import { FlatList, Platform } from 'react-native';

import { MatchHistoryCard } from '../components/game/MatchHistoryCard';
import { SettlementCard } from '../components/game/SettlementCard';
import { GameLobbyScreen } from '../screens/app/GameLobbyScreen';
import { SettlementScreen } from '../screens/app/SettlementScreen';
import { useGameStore } from '../store/gameStore';

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
  useGameStore.getState().addRound({
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
  useGameStore
    .getState()
    .addRound({ winnerId: 'a', loserIds: ['b'], amount: 10, gameType: 'solo' });
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
