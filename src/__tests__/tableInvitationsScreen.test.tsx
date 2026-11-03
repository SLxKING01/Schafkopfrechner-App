import { act } from 'react';

import { InvitationsContent } from '../screens/app/TableInvitationsScreen';
import { readFriends } from '../services/friends/friends';
import {
  publishSharedTable,
  refreshSharedTables,
  syncSharedTable,
} from '../services/shared/sharedTables';
import {
  executeInvitation,
  listTableInvitations,
  readInvitationOperation,
} from '../services/shared/tableInvitations';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import type {
  InvitationCommand,
  TableInvitation,
} from '../types/tableInvitation';
const renderer = jest.requireActual('react-test-renderer');
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../services/shared/tableInvitations', () => ({
  ...jest.requireActual('../services/shared/tableInvitations'),
  executeInvitation: jest.fn(),
  listTableInvitations: jest.fn(),
  readInvitationOperation: jest.fn(),
}));
jest.mock('../services/friends/friends', () => ({ readFriends: jest.fn() }));
jest.mock('../services/shared/sharedTables', () => ({
  publishSharedTable: jest.fn(),
  refreshSharedTables: jest.fn(async () => {}),
  syncSharedTable: jest.fn(async () => {}),
  sharedSnapshot: jest.fn(() => ({})),
}));
jest.mock('../services/sync/syncGameState', () => ({
  fingerprint: () => 'baseline',
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '30000000-0000-4000-8000-000000000001',
}));
jest.mock('../components/profile/ProfileAvatar', () => ({
  ProfileAvatar: () => null,
}));
jest.mock('../components/auth/AuthBackground', () => ({
  AuthBackground: jest.requireActual('react-native').View,
}));
jest.mock('react-native', () => {
  const N = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  return new Proxy(N, {
    get: (target, key) => {
      if (key === 'FlatList')
        return function MockList(p: {
          data: TableInvitation[];
          ListHeaderComponent: React.ReactNode;
          ListEmptyComponent: React.ReactNode;
          renderItem: (i: unknown) => React.ReactNode;
        }) {
          return R.createElement(
            N.View,
            null,
            p.ListHeaderComponent,
            p.data.length
              ? p.data.map((item) =>
                  R.createElement(
                    N.View,
                    { key: item.id },
                    p.renderItem({ item }),
                  ),
                )
              : p.ListEmptyComponent,
          );
        };
      return target[key];
    },
  });
});
const actor = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const tableId = '10000000-0000-4000-8000-000000000001';
const card = {
  id: other,
  displayName: 'Anna',
  avatarKind: 'none' as const,
  animalId: null,
  accentId: 'forestGreen' as const,
  photoPath: null,
  version: 1,
};
const invitation: TableInvitation = {
  id: '20000000-0000-4000-8000-000000000001',
  tableId,
  tableName: 'Spielabend',
  playerId: 'seat',
  playerName: 'Lokale Anna',
  sender: card,
  recipient: { ...card, id: actor, displayName: 'Ich' },
  role: 'write',
  createdAt: '2026-11-03T00:00:00Z',
  expiresAt: '2026-11-10T00:00:00Z',
  available: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: { id: actor } as never });
  useGameStore.setState({
    currentTable: {
      id: tableId,
      name: 'Spielabend',
      isActive: true,
      shared: {
        userId: actor,
        ownerId: actor,
        version: 4,
        baseline: 'baseline',
      },
    } as never,
    players: [{ id: 'seat', name: 'Lokale Anna', isLocal: true }],
  });
  jest
    .mocked(listTableInvitations)
    .mockResolvedValue({ userId: actor, invitations: [invitation] });
  jest.mocked(readInvitationOperation).mockResolvedValue(null);
  jest
    .mocked(executeInvitation)
    .mockResolvedValue({ userId: actor, invitations: [] });
  jest
    .mocked(readFriends)
    .mockResolvedValue({ friends: [{ profile: card }] } as never);
});
async function mount(tid?: string) {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <InvitationsContent actor={actor} tableId={tid} onBack={jest.fn()} />,
    );
  });
  const button = (label: string) =>
    view.root
      .findAllByProps({ accessibilityLabel: label })
      .find(
        (n: { props: { onPress?: unknown } }) =>
          typeof n.props.onPress === 'function',
      )!;
  return {
    view: view!,
    button,
    press: async (label: string) => {
      await act(async () => {
        await button(label).props.onPress();
      });
    },
    text: () => JSON.stringify(view.toJSON()),
  };
}
it('shows invitation context and grants nothing before explicit acceptance', async () => {
  const ui = await mount();
  expect(ui.text()).toContain('Lokale Anna');
  expect(ui.text()).toContain('Spielabend');
  expect(executeInvitation).not.toHaveBeenCalled();
  await ui.press('Einladung annehmen');
  expect(executeInvitation).toHaveBeenCalledWith(actor, {
    action: 'accept',
    id: invitation.id,
  });
  expect(refreshSharedTables).toHaveBeenCalled();
  expect(ui.text()).toContain('Einladung angenommen.');
  await act(async () => ui.view.unmount());
});
it('declines explicitly and disables acceptance of unavailable invitations', async () => {
  jest.mocked(listTableInvitations).mockResolvedValue({
    userId: actor,
    invitations: [{ ...invitation, available: false }],
  });
  const ui = await mount();
  expect(ui.button('Einladung annehmen').props.disabled).toBe(true);
  await ui.press('Einladung ablehnen');
  expect(executeInvitation).toHaveBeenCalledWith(actor, {
    action: 'decline',
    id: invitation.id,
  });
  await act(async () => ui.view.unmount());
});
it('keeps context on refresh failure and can retry', async () => {
  const ui = await mount();
  jest.mocked(listTableInvitations).mockRejectedValueOnce(Error('offline'));
  await ui.press('Einladungen aktualisieren');
  expect(ui.text()).toContain('Spielabend');
  expect(ui.text()).toContain('nicht vollständig geladen');
  await ui.press('Einladungen aktualisieren');
  expect(ui.text()).not.toContain('nicht vollständig geladen');
  await act(async () => ui.view.unmount());
});
it('restores the exact pending operation and blocks new actions until recovery', async () => {
  const saved: InvitationCommand = { action: 'accept', id: invitation.id };
  jest.mocked(readInvitationOperation).mockResolvedValue(saved);
  const ui = await mount();
  expect(ui.button('Einladung annehmen').props.disabled).toBe(true);
  await ui.press('Auftrag prüfen');
  expect(executeInvitation).toHaveBeenCalledWith(actor, saved);
  await act(async () => ui.view.unmount());
});
it('requires an explicit seat, friend and role and uses the synchronized table version', async () => {
  jest
    .mocked(listTableInvitations)
    .mockResolvedValue({ userId: actor, invitations: [] });
  const ui = await mount(tableId);
  expect(ui.button('Einladung senden').props.disabled).toBe(true);
  await ui.press('Platz: Lokale Anna');
  await ui.press('Anna');
  await ui.press('Schreiben');
  await ui.press('Einladung senden');
  expect(syncSharedTable).toHaveBeenCalled();
  expect(executeInvitation).toHaveBeenCalledWith(
    actor,
    expect.objectContaining({
      action: 'send',
      playerId: 'seat',
      recipientId: other,
      role: 'write',
      version: 4,
      tableId,
    }),
  );
  await act(async () => ui.view.unmount());
});
it('immediately hides the previous account context', async () => {
  const ui = await mount();
  await act(async () =>
    useAuthStore.setState({ user: { id: other } as never }),
  );
  expect(ui.text()).not.toContain('Spielabend');
  expect(ui.text()).toContain('Konto hat sich geändert');
  await act(async () => ui.view.unmount());
});
it('publishes a local table without a linked owner seat when the owner sends an invitation', async () => {
  const shared = useGameStore.getState().currentTable!;
  useGameStore.setState({ currentTable: { ...shared, shared: undefined } });
  jest.mocked(publishSharedTable).mockImplementationOnce(async () => {
    useGameStore.setState({ currentTable: shared });
    return undefined;
  });
  jest
    .mocked(listTableInvitations)
    .mockResolvedValue({ userId: actor, invitations: [] });
  const ui = await mount(tableId);
  await ui.press('Platz: Lokale Anna');
  await ui.press('Anna');
  await ui.press('Einladung senden');
  expect(publishSharedTable).toHaveBeenCalledWith({ actor, tableId });
  expect(executeInvitation).toHaveBeenCalledWith(
    actor,
    expect.objectContaining({ action: 'send', role: 'read', version: 4 }),
  );
  await act(async () => ui.view.unmount());
});
