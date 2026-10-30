import type { CreateGameInput } from '../models/Game';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
const input: CreateGameInput = {
  winnerId: 'a',
  loserIds: ['b'],
  amount: 1,
  gameTypeId: 'sauspiel',
  options: { laufende: 0, schneider: false, schwarz: false },
};
beforeEach(() => {
  useGameStore.setState({
    games: [],
    currentTable: null,
    archivedGameDays: [],
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: false,
  });
  usePlayerStore.setState({
    players: [
      { id: 'a', name: 'Anna' },
      { id: 'b', name: 'Berkay' },
    ],
  });
  useMatchDayStore.setState({ matchDays: [], activeMatchDayId: null });
  useMatchDayStore.getState().createMatchDay('Freitag');
});

it.each([
  { winnerId: 'ghost' },
  { loserIds: ['ghost'] },
  { loserIds: ['b', 'b'] },
  { loserIds: ['a'] },
  { amount: 0.001 },
  { matchDayId: 'missing' },
])('validates offline input as strictly as table rounds %#', (override) => {
  expect(useGameStore.getState().addGame({ ...input, ...override })).toBe(
    false,
  );
  expect(useGameStore.getState().games).toEqual([]);
});

it('stores exact cents and retains original identity on a legitimate correction', () => {
  expect(useGameStore.getState().addGame({ ...input, amount: 0.1 + 0.2 })).toBe(
    true,
  );
  const original = useGameStore.getState().games[0];
  expect(original.amount).toBe(0.3);
  expect(
    useGameStore
      .getState()
      .updateGame({ ...original, amount: 0.7, createdAt: 'forged' }),
  ).toBe(true);
  expect(useGameStore.getState().games[0]).toMatchObject({
    id: original.id,
    createdAt: original.createdAt,
    amount: 0.7,
  });
  expect(
    useGameStore.getState().updateGame({ ...original, loserIds: ['b', 'b'] }),
  ).toBe(false);
  expect(useGameStore.getState().games[0].amount).toBe(0.7);
});

it('prevents changing a closed evening by moving its game into a new open day', () => {
  useGameStore.getState().addGame(input);
  const original = useGameStore.getState().games[0];
  const closedId = useMatchDayStore.getState().activeMatchDayId!;
  useMatchDayStore.getState().closeMatchDay(closedId);
  const closed = useMatchDayStore.getState().matchDays[0];
  useMatchDayStore.getState().createMatchDay('Samstag');
  const openId = useMatchDayStore.getState().activeMatchDayId!;
  expect(
    useGameStore
      .getState()
      .updateGame({ ...original, matchDayId: openId, amount: 99 }),
  ).toBe(false);
  expect(
    useGameStore.getState().addGame({ ...input, matchDayId: closedId }),
  ).toBe(false);
  useGameStore.getState().removeGame(original.id);
  useMatchDayStore.getState().setActiveMatchDay(closedId);
  expect(useGameStore.getState().undoLastGame()).toBe(false);
  useMatchDayStore.getState().removeMatchDay(closedId);
  useMatchDayStore.getState().closeMatchDay(closedId);
  expect(useGameStore.getState().games).toEqual([original]);
  expect(
    useMatchDayStore.getState().matchDays.find(({ id }) => id === closedId),
  ).toEqual(closed);
});

it('keeps player identities referenced by recorded games, including after closure', () => {
  expect(useGameStore.getState().addGame(input)).toBe(true);
  expect(usePlayerStore.getState().removePlayer('a')).toBe(false);
  useMatchDayStore
    .getState()
    .closeMatchDay(useMatchDayStore.getState().activeMatchDayId!);
  expect(usePlayerStore.getState().removePlayer('b')).toBe(false);
  expect(usePlayerStore.getState().players.map(({ id }) => id)).toEqual([
    'a',
    'b',
  ]);
});

it('refuses to close an offline day with corrupted participants', () => {
  useGameStore.getState().addGame(input);
  const original = useGameStore.getState().games[0];
  useGameStore.setState({ games: [{ ...original, winnerId: 'ghost' }] });
  const id = useMatchDayStore.getState().activeMatchDayId!;
  useMatchDayStore.getState().closeMatchDay(id);
  expect(
    useMatchDayStore.getState().matchDays.find((day) => day.id === id)
      ?.isClosed,
  ).toBe(false);
  expect(useGameStore.getState().games[0].winnerId).toBe('ghost');
});

it('rejects deleting an offsetting round if the resulting balance would overflow', () => {
  const amount = Number.MAX_SAFE_INTEGER / 100;
  expect(useGameStore.getState().addGame({ ...input, amount })).toBe(true);
  expect(
    useGameStore
      .getState()
      .addGame({ ...input, winnerId: 'b', loserIds: ['a'], amount }),
  ).toBe(true);
  expect(useGameStore.getState().addGame({ ...input, amount })).toBe(true);
  const original = useGameStore.getState().games;
  useGameStore.getState().removeGame(original[1].id);
  expect(useGameStore.getState().games).toEqual(original);
});
