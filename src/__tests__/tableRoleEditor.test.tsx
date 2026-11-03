import { act } from 'react';

import { PlayerAccountsEditor } from '../components/game/PlayerAccountsEditor';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';

const renderer = jest.requireActual('react-test-renderer');
const mockRole = jest.fn();
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
jest.mock('../services/shared/sharedTables', () => ({
  setSharedTableRole: (...args: unknown[]) => mockRole(...args),
}));
jest.mock('../components/game/AccountPicker', () => ({
  AccountPicker: () => null,
}));

beforeEach(() => {
  mockRole.mockReset();
  useAuthStore.setState({ user: { id: 'owner' } as never });
  useGameStore.setState({
    currentTable: null,
    players: [],
    rounds: [],
    balances: [],
    settlements: [],
    archivedGameDays: [],
    activeGame: false,
  });
  useGameStore.getState().createTable('Rollen', [
    { id: 'a', name: 'Anna', userId: 'owner', isLocal: false },
    { id: 'b', name: 'Max', userId: 'member', isLocal: false },
  ]);
  const table = useGameStore.getState().currentTable!;
  useGameStore.setState({
    currentTable: {
      ...table,
      shared: {
        userId: 'owner',
        ownerId: 'owner',
        role: 'write',
        members: [{ userId: 'member', role: 'read' }],
        baseline: '{}',
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    },
  });
});
function button(view: ReturnType<typeof renderer.create>, label: string) {
  return view.root
    .findAllByProps({ accessibilityLabel: label })
    .find(
      (n: { props: { onPress?: unknown } }) =>
        typeof n.props.onPress === 'function',
    )!;
}

it('keeps read access selected after failure and allows retry', async () => {
  mockRole
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(undefined);
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<PlayerAccountsEditor />);
  });
  await act(async () =>
    button(view, 'Max: Schreiben erlauben').props.onPress(),
  );
  expect(JSON.stringify(view.toJSON())).toContain('Offline');
  expect(
    button(view, 'Max: Lesen erlauben').props.accessibilityState.selected,
  ).toBe(true);
  expect(button(view, 'Max: Schreiben erlauben').props.disabled).toBe(false);
  await act(async () =>
    button(view, 'Max: Schreiben erlauben').props.onPress(),
  );
  expect(mockRole).toHaveBeenLastCalledWith('member', 'write');
  expect(mockRole).toHaveBeenCalledTimes(2);
  await act(async () => view.unmount());
});

it('prevents a double tap while a role change is pending', async () => {
  let finish!: () => void;
  mockRole.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<PlayerAccountsEditor />);
  });
  const press = button(view, 'Max: Schreiben erlauben').props.onPress;
  await act(async () => {
    press();
    press();
  });
  expect(mockRole).toHaveBeenCalledTimes(1);
  expect(button(view, 'Max: Lesen erlauben').props.disabled).toBe(true);
  await act(async () => finish());
  await act(async () => view.unmount());
});

it('offers no role management to a non-owner', async () => {
  useAuthStore.setState({ user: { id: 'member' } as never });
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<PlayerAccountsEditor />);
  });
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Max: Schreiben erlauben' }),
  ).toHaveLength(0);
  await act(async () => view.unmount());
});
