import { act } from 'react';
import { Platform } from 'react-native';

import { OpenSettlementCard } from '../components/dashboard/OpenSettlementCard';
import { QuickActionCard } from '../components/dashboard/QuickActionCard';
import { RecentGameCard } from '../components/dashboard/RecentGameCard';
import { StatsCard } from '../components/dashboard/StatsCard';
import { DashboardScreen } from '../screens/app/DashboardScreen';
import { StatisticsScreen } from '../screens/app/StatisticsScreen';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';

const renderer = jest.requireActual('react-test-renderer');
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
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
jest.mock('../components/auth/AuthBackground', () => ({
  AuthBackground: jest.requireActual('react-native').View,
}));
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  mockNavigate.mockClear();
  useGameStore.setState({
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
    games: [],
    activeGame: false,
  });
  usePlayerStore.setState({ players: [] });
  useMatchDayStore.setState({ matchDays: [], activeMatchDayId: null });
});
afterEach(() => jest.restoreAllMocks());
function table() {
  useGameStore.getState().createTable('Echter Tisch', [
    { id: 'a', name: 'Anna', isLocal: true },
    { id: 'b', name: 'Ben', isLocal: true },
  ]);
  useGameStore.getState().addRound({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 1.2,
    gameType: 'rufspiel',
  });
}
it('renders empty dashboard and statistics without sample games or payments', async () => {
  let dashboard: ReturnType<typeof renderer.create>;
  let stats: ReturnType<typeof renderer.create>;
  await act(async () => {
    dashboard = renderer.create(<DashboardScreen />);
    stats = renderer.create(<StatisticsScreen />);
  });
  expect(dashboard.root.findByType(StatsCard).props.stats).toEqual(
    expect.arrayContaining([
      { label: 'Runden gesamt', value: '0' },
      { label: 'Zahlungen offen', value: '0,00 €', tone: 'gold' },
    ]),
  );
  expect(dashboard.root.findAllByType(RecentGameCard)).toHaveLength(0);
  expect(dashboard.root.findAllByType(OpenSettlementCard)).toHaveLength(0);
  expect(
    stats.root.findAllByProps({ title: 'Noch keine Statistik' }).length,
  ).toBeGreaterThan(0);
  await act(async () =>
    dashboard.root
      .findAllByType(QuickActionCard)
      .find(
        (node: { props: { title: string } }) =>
          node.props.title === 'Tisch erstellen',
      )!
      .props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('CreateTable');
  await act(async () => {
    dashboard.unmount();
    stats.unmount();
  });
});
it('continues the active table and opens the exact archived payment with live paid-state updates', async () => {
  table();
  let dashboard: ReturnType<typeof renderer.create>;
  await act(async () => {
    dashboard = renderer.create(<DashboardScreen />);
  });
  expect(dashboard.root.findAllByType(OpenSettlementCard)).toHaveLength(0);
  await act(async () =>
    dashboard.root
      .findAllByType(QuickActionCard)
      .find(
        (node: { props: { title: string } }) =>
          node.props.title === 'Weiterspielen',
      )!
      .props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('ActiveGame');
  await act(async () => useGameStore.getState().finishGameDay());
  const archived = useGameStore.getState().archivedGameDays[0];
  expect(dashboard.root.findByType(RecentGameCard).props).toMatchObject({
    winner: 'Anna',
    amount: '1,20 €',
  });
  expect(dashboard.root.findByType(OpenSettlementCard).props).toMatchObject({
    from: 'Ben',
    to: 'Anna',
    amount: '1,20 €',
  });
  await act(async () =>
    dashboard.root.findByType(OpenSettlementCard).props.onOpen(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('Settlement', {
    tableId: archived.table.id,
  });
  expect(dashboard.root.findByType(StatsCard).props.stats[0].value).toBe('1');
  await act(async () =>
    useGameStore
      .getState()
      .markSettlementPaid(archived.settlements[0].id, true, archived.table.id),
  );
  expect(dashboard.root.findAllByType(OpenSettlementCard)).toHaveLength(0);
  await act(async () => dashboard.unmount());
});
it('opens older offline history from real recent rounds', async () => {
  usePlayerStore.setState({
    players: [
      { id: 'a', name: 'Anna' },
      { id: 'b', name: 'Ben' },
    ],
  });
  useMatchDayStore.setState({
    matchDays: [
      {
        id: 'old',
        name: 'Alt',
        createdAt: new Date().toISOString(),
        isActive: true,
        isClosed: false,
      },
    ],
    activeMatchDayId: 'old',
  });
  useGameStore.getState().addGame({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 1,
    gameTypeId: 'solo',
    options: {} as never,
  });
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<DashboardScreen />);
  });
  await act(async () => view.root.findByType(RecentGameCard).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('MatchDayDetails', {
    matchDayId: 'old',
  });
  await act(async () => view.unmount());
});
