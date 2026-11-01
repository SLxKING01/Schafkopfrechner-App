import { act } from 'react';
import { Platform } from 'react-native';

import { Metric, StatAction } from '../components/statistics/StatisticsPanels';
import { DashboardScreen } from '../screens/app/DashboardScreen';
import { StatisticsScreen } from '../screens/app/StatisticsScreen';
import { useSharedTableStatus } from '../services/shared/sharedTables';
import { useAuthStore } from '../store/authStore';
import { useDashboardIdentityStore } from '../store/dashboardIdentityStore';
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
jest.mock('../components/auth/AuthBackground', () => {
  const { View } = jest.requireActual('react-native');
  return {
    AuthBackground: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  mockNavigate.mockClear();
  useAuthStore.setState({ user: null });
  useSharedTableStatus.setState({
    tables: [],
    tablesUserId: null,
    error: null,
    conflict: null,
    busy: false,
  });
  useDashboardIdentityStore.setState({ selections: {}, hydrated: true });
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

it('switches between overall, player and table statistics and opens a selected trend round', async () => {
  useGameStore.getState().createTable(
    'Statistiktisch',
    ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      name: id.toUpperCase(),
      isLocal: true,
    })),
  );
  useGameStore.getState().addRound({
    gameType: 'rufspiel',
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    declarerId: 'a',
    partnerId: 'b',
    amount: 0.4,
    suit: 'eichel',
  });
  useGameStore.getState().addRound({
    gameType: 'rufspiel',
    winnerId: 'c',
    winnerIds: ['c', 'd'],
    loserIds: ['a', 'b'],
    declarerId: 'b',
    partnerId: 'a',
    amount: 0.8,
    suit: 'gras',
  });
  const first = useGameStore.getState().rounds[0];
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<StatisticsScreen />);
  });
  const action = (title: string) =>
    view.root
      .findAllByType(StatAction)
      .find(
        (node: { props: { children: unknown } }) =>
          node.props.children === title,
      )!;
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  expect(
    view.root
      .findAllByType(Metric)
      .find(
        (node: { props: { label: string } }) =>
          node.props.label === 'Gespielte Runden',
      )?.props.value,
  ).toBe('2');
  await act(async () => action('Spieler').props.onPress());
  expect(
    view.root
      .findAllByType(Metric)
      .find(
        (node: { props: { label: string } }) =>
          node.props.label === 'Spielbilanz',
      )?.props.value,
  ).toBe('-0,20 €');
  await act(async () => button('Rufspiel auswerten').props.onPress());
  expect(JSON.stringify(view.toJSON())).toContain('Deine Rolle');
  expect(JSON.stringify(view.toJSON())).toContain('Eichel');
  await act(async () => action('Tisch').props.onPress());
  expect(JSON.stringify(view.toJSON())).toContain('Sauspiel-Partnerschaften');
  await act(async () => button('Partnerschaft A und B öffnen').props.onPress());
  expect(JSON.stringify(view.toJSON())).toContain(
    'Gemeinsame Spiele nach Farbe',
  );
  await act(async () => button('Vorherige Runde im Trend').props.onPress());
  await act(async () => action('Ausgewähltes Spiel öffnen').props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('ActiveGame', {
    roundId: first.id,
  });
  await act(async () => useGameStore.getState().finishGameDay());
  await act(async () => action('Ausgewähltes Spiel öffnen').props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Settlement', {
    tableId: useGameStore.getState().archivedGameDays[0].table.id,
    roundId: first.id,
  });
  await act(async () => view.unmount());
});
function table(accountId?: string) {
  useGameStore.getState().createTable('Echter Tisch', [
    { id: 'a', name: 'Anna', isLocal: true, userId: accountId },
    { id: 'b', name: 'Ben', isLocal: true },
  ]);
  useGameStore.getState().addRound({
    winnerId: 'a',
    loserIds: ['b'],
    amount: 1.2,
    gameType: 'rufspiel',
  });
}
async function mountDashboard() {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<DashboardScreen />);
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (node: { props: { onPress?: unknown } }) =>
          typeof node.props.onPress === 'function',
      )!;
  const press = async (label: string) => {
    await act(async () => button(label).props.onPress());
  };
  return { view: view!, button, press };
}
it('keeps an empty dashboard focused on personal statistics and the table tab', async () => {
  const ui = await mountDashboard();
  expect(ui.button('Gesamtbilanz: 0,00 €')).toBeTruthy();
  expect(ui.button('Spiele gesamt: 0')).toBeTruthy();
  expect(ui.button('Gewinnquote: –')).toBeTruthy();
  expect(JSON.stringify(ui.view.toJSON())).not.toContain('Schnellzugriff');
  expect(JSON.stringify(ui.view.toJSON())).not.toContain('Letzte Spiele');
  expect(
    ui.view.root.findAllByProps({
      accessibilityLabel: 'Offene Abrechnungen öffnen',
    }),
  ).toHaveLength(0);
  await ui.press('Alle Tische ansehen');
  expect(mockNavigate).toHaveBeenCalledWith('AppTabs', { screen: 'GameLobby' });
  await act(async () => ui.view.unmount());
});
it('automatically uses the authenticated account and keeps its totals through archive and payment updates', async () => {
  useAuthStore.setState({
    user: { id: 'account-anna', user_metadata: { username: 'Anna' } } as never,
  });
  table('account-anna');
  const ui = await mountDashboard();
  expect(
    ui.view.root.findAllByProps({
      accessibilityLabel: 'Spielerzuordnung ändern',
    }),
  ).toHaveLength(0);
  expect(
    ui.view.root.findAllByProps({
      accessibilityLabel: 'Fehlende Spieler zuordnen',
    }),
  ).toHaveLength(0);
  expect(ui.button('Gesamtbilanz: +1,20 €')).toBeTruthy();
  expect(ui.button('Spiele gesamt: 1')).toBeTruthy();
  expect(ui.button('Gewinnquote: 100\u00a0%')).toBeTruthy();
  await ui.press('Alle Tische ansehen');
  expect(mockNavigate).toHaveBeenCalledWith('AppTabs', { screen: 'GameLobby' });
  await act(async () => useGameStore.getState().finishGameDay());
  const archived = useGameStore.getState().archivedGameDays[0];
  expect(ui.button('Gesamtbilanz: +1,20 €')).toBeTruthy();
  await ui.press('Offene Abrechnungen öffnen');
  expect(mockNavigate).toHaveBeenCalledWith('Settlement', {
    tableId: archived.table.id,
  });
  await act(async () =>
    useGameStore
      .getState()
      .markSettlementPaid(archived.settlements[0].id, true, archived.table.id),
  );
  expect(
    ui.view.root.findAllByProps({
      accessibilityLabel: 'Offene Abrechnungen öffnen',
    }),
  ).toHaveLength(0);
  expect(ui.button('Gesamtbilanz: +1,20 €')).toBeTruthy();
  await act(async () => ui.view.unmount());
});
it('counts unpaid tables rather than transfer rows and offers each table when several remain open', async () => {
  for (const name of ['Erster Tisch', 'Zweiter Tisch']) {
    useGameStore.getState().createTable(
      name,
      ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, isLocal: true })),
    );
    useGameStore.getState().addRound({
      gameType: 'solo',
      winnerId: 'a',
      loserIds: ['b', 'c', 'd'],
      amount: 1.5,
    });
    await useGameStore.getState().finishGameDay();
  }
  const ui = await mountDashboard();
  expect(JSON.stringify(ui.view.toJSON())).toContain('Tische noch offen');
  await ui.press('Offene Abrechnungen öffnen');
  await ui.press('Abrechnung Erster Tisch öffnen');
  expect(mockNavigate).toHaveBeenCalledWith('Settlement', {
    tableId: useGameStore
      .getState()
      .archivedGameDays.find((day) => day.table.name === 'Erster Tisch')!.table
      .id,
  });
  await act(async () => ui.view.unmount());
});
it('opens the table overview and profile without offering a blocked new table action', async () => {
  table();
  const ui = await mountDashboard();
  await ui.press('Alle Tische ansehen');
  expect(mockNavigate).toHaveBeenCalledWith('AppTabs', { screen: 'GameLobby' });
  await ui.press('Alle Tische ansehen');
  expect(mockNavigate).toHaveBeenCalledWith('AppTabs', { screen: 'GameLobby' });
  await ui.press('Profil öffnen');
  expect(mockNavigate).toHaveBeenCalledWith('AppTabs', { screen: 'Profile' });
  await act(async () => ui.view.unmount());
});
it('excludes old guest games without an account link instead of guessing from names', async () => {
  useAuthStore.setState({
    user: { id: 'account-anna', user_metadata: { username: 'Anna' } } as never,
  });
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
  const ui = await mountDashboard();
  expect(ui.button('Gesamtbilanz: 0,00 €')).toBeTruthy();
  await ui.press('Spiele gesamt: 0');
  expect(mockNavigate).toHaveBeenCalledWith('AppTabs', {
    screen: 'Statistics',
  });
  await act(async () => ui.view.unmount());
});
it('uses the signed-in account and ignores old manual guest assignments', async () => {
  useAuthStore.setState({
    user: { id: 'account-anna', user_metadata: { username: 'Anna' } } as never,
  });
  table('account-anna');
  useDashboardIdentityStore
    .getState()
    .select('guest', `table:${useGameStore.getState().currentTable!.id}`, 'a');
  const ui = await mountDashboard();
  expect(ui.button('Gesamtbilanz: +1,20 €')).toBeTruthy();
  await act(async () =>
    useAuthStore.setState({
      user: {
        id: 'different',
        user_metadata: {},
        email: 'other@example.test',
      } as never,
    }),
  );
  expect(ui.button('Gesamtbilanz: 0,00 €')).toBeTruthy();
  await act(async () => useAuthStore.setState({ user: null }));
  expect(ui.button('Gesamtbilanz: –')).toBeTruthy();
  await act(async () => ui.view.unmount());
});
it('uses the same account-based personal totals in dashboard and player statistics', async () => {
  useAuthStore.setState({
    user: { id: 'account-anna', user_metadata: { username: 'Anna' } } as never,
  });
  table('account-anna');
  await useGameStore.getState().finishGameDay();
  table('account-anna');
  const ui = await mountDashboard();
  expect(ui.button('Gesamtbilanz: +2,40 €')).toBeTruthy();
  expect(ui.button('Spiele gesamt: 2')).toBeTruthy();
  let stats: ReturnType<typeof renderer.create>;
  await act(async () => {
    stats = renderer.create(<StatisticsScreen />);
  });
  const playerTab = stats.root
    .findAllByType(StatAction)
    .find(
      (node: { props: { children: unknown } }) =>
        node.props.children === 'Spieler',
    )!;
  await act(async () => playerTab.props.onPress());
  expect(
    stats.root
      .findAllByType(Metric)
      .find(
        (node: { props: { label: string } }) =>
          node.props.label === 'Spielbilanz',
      )?.props.value,
  ).toBe('+2,40 €');
  expect(JSON.stringify(stats.toJSON())).toContain('Meine Gesamtstatistik');
  await act(async () => {
    ui.view.unmount();
    stats.unmount();
  });
});

it.each([
  { username: 'Karl', display_name: 'Anderer Name' },
  { display_name: 'Karl' },
])(
  'uses the account name for the greeting without falling back to the email address',
  async (metadata) => {
    useAuthStore.setState({
      user: {
        id: 'account-karl',
        email: 'nicht-der-name@example.com',
        user_metadata: metadata,
      } as never,
    });
    const ui = await mountDashboard();
    const rendered = JSON.stringify(ui.view.toJSON());
    expect(rendered).toContain('Karl');
    expect(rendered).not.toContain('nicht-der-name');
    expect(rendered).not.toContain('Anderer Name');
    await act(async () => ui.view.unmount());
  },
);
it('shows no table cards on the dashboard even when local and shared tables exist', async () => {
  useGameStore.getState().createTable(
    'Nur im Tischreiter',
    ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, isLocal: true })),
  );
  const state = useGameStore.getState();
  useAuthStore.setState({
    user: { id: 'account-karl', user_metadata: { username: 'Karl' } } as never,
  });
  useSharedTableStatus.setState({
    tablesUserId: 'account-karl',
    tables: [
      {
        id: 'shared-table',
        version: 1,
        updatedAt: new Date().toISOString(),
        payload: {
          currentTable: {
            ...state.currentTable!,
            id: 'shared-table',
            name: 'Gemeinsamer Tisch',
          },
          players: state.players,
          rounds: state.rounds,
          balances: state.balances,
          settlements: state.settlements,
          activeGame: true,
        },
      },
    ],
  });
  const ui = await mountDashboard();
  const rendered = JSON.stringify(ui.view.toJSON());
  expect(rendered).not.toContain('Nur im Tischreiter');
  expect(rendered).not.toContain('Gemeinsamer Tisch');
  expect(rendered).not.toContain('Tisch erstellen');
  expect(ui.button('Alle Tische ansehen')).toBeTruthy();
  await act(async () => ui.view.unmount());
});
