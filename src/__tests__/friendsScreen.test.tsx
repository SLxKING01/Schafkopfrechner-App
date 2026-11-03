import * as Clipboard from 'expo-clipboard';
import { act } from 'react';
import { TextInput } from 'react-native';

import { FriendsContent } from '../screens/app/FriendsScreen';
import {
  executeFriendCommand,
  findFriend,
  FriendError,
  readFriends,
} from '../services/friends/friends';
import { readFriendOperation } from '../services/friends/friendStorage';
import { useAuthStore } from '../store/authStore';
import { resetFriendsSession } from '../store/friendsStore';
import type { FriendEntry, FriendSearch, FriendsState } from '../types/friends';
const renderer = jest.requireActual('react-test-renderer');
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../services/friends/friends', () => ({
  ...jest.requireActual('../services/friends/friends'),
  readFriends: jest.fn(),
  findFriend: jest.fn(),
  executeFriendCommand: jest.fn(),
}));
jest.mock('../services/friends/friendStorage', () => ({
  readFriendOperation: jest.fn(async () => null),
}));
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
}));
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () =>
      `30000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  };
});
jest.mock('../components/profile/ProfileAvatar', () => ({
  ProfileAvatar: () => null,
}));
jest.mock('../components/auth/AuthBackground', () => ({
  AuthBackground: jest.requireActual('react-native').View,
}));
jest.mock('../components/auth/GoldButton', () => ({
  GoldButton: (props: { title: string }) => {
    const R = jest.requireActual('react');
    const N = jest.requireActual('react-native');
    return R.createElement(
      N.Pressable,
      { ...props, accessibilityLabel: props.title },
      R.createElement(N.Text, null, props.title),
    );
  },
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const React = jest.requireActual('react');
  return new Proxy(native, {
    get: (target, key) => {
      if (key === 'Modal')
        return ({
          visible,
          children,
        }: {
          visible: boolean;
          children: React.ReactNode;
        }) => (visible ? children : null);
      if (key === 'SectionList')
        return function MockSectionList(props: {
          sections: { key: string; data: { profile: { id: string } }[] }[];
          ListHeaderComponent: React.ReactNode;
          renderSectionHeader: (info: unknown) => React.ReactNode;
          renderItem: (info: unknown) => React.ReactNode;
        }) {
          return React.createElement(
            native.View,
            null,
            props.ListHeaderComponent,
            props.sections.map((section) =>
              React.createElement(
                native.View,
                { key: section.key },
                props.renderSectionHeader({ section }),
                section.data.map((item) =>
                  React.createElement(
                    native.View,
                    { key: item.profile.id },
                    props.renderItem({ item, section }),
                  ),
                ),
              ),
            ),
          );
        };
      return target[key];
    },
  });
});
const actor = '00000000-0000-4000-8000-000000000001';
const target = '00000000-0000-4000-8000-000000000002';
const entry: FriendEntry = {
  profile: {
    id: target,
    displayName: 'Kontakt Anna',
    avatarKind: 'none',
    animalId: null,
    accentId: 'forestGreen',
    photoPath: null,
    version: 1,
  },
  pairVersion: 0,
  requestId: null,
  blockId: null,
};
const initial: FriendsState = {
  userId: actor,
  version: 1,
  code: 'AAAA2222BBBB',
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
};
const found: FriendSearch = {
  userId: actor,
  status: 'found',
  relation: 'none',
  entry,
};
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: { id: actor } as never });
  resetFriendsSession();
  jest.mocked(readFriendOperation).mockResolvedValue(null);
  jest.mocked(readFriends).mockResolvedValue(initial);
  jest.mocked(findFriend).mockResolvedValue(found);
  jest
    .mocked(executeFriendCommand)
    .mockResolvedValue({ ...initial, version: 2 });
});
async function mount() {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(<FriendsContent actor={actor} onBack={jest.fn()} />);
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
      await act(async () => button(label).props.onPress());
    },
    code: async (value: string) => {
      await act(async () =>
        view.root
          .findAllByType(TextInput)
          .find(
            (n: { props: { accessibilityLabel?: string } }) =>
              n.props.accessibilityLabel === 'Freundescode eingeben',
          )!
          .props.onChangeText(value),
      );
    },
  };
}
it('shows a resolved empty list and copies the formatted personal code', async () => {
  const ui = await mount();
  expect(JSON.stringify(ui.view.toJSON())).toContain('Noch keine Freunde.');
  await ui.press('Code kopieren');
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('AAAA-2222-BBBB', {
    android: { isSensitive: true },
  });
  await act(async () => ui.view.unmount());
});
it('checks the full code and target preview before sending', async () => {
  const ui = await mount();
  await ui.press('Freund hinzufügen');
  await ui.code('CCCC');
  expect(ui.button('Kontakt suchen').props.disabled).toBe(true);
  await ui.code('CCCC-3333-DDDD');
  await ui.press('Kontakt suchen');
  expect(JSON.stringify(ui.view.toJSON())).toContain('Kontakt Anna');
  expect(executeFriendCommand).not.toHaveBeenCalled();
  await ui.press('Anfrage senden');
  expect(executeFriendCommand).toHaveBeenCalledWith(
    actor,
    expect.objectContaining({
      action: 'send',
      targetId: target,
      expectedVersion: 0,
      code: 'CCCC3333DDDD',
    }),
  );
  await act(async () => ui.view.unmount());
});
it('offers explicit acceptance for a counter-request without automatically accepting it', async () => {
  jest.mocked(findFriend).mockResolvedValue({
    ...found,
    relation: 'incoming',
    entry: {
      ...entry,
      pairVersion: 1,
      requestId: '10000000-0000-4000-8000-000000000001',
    },
  });
  const ui = await mount();
  await ui.press('Freund hinzufügen');
  await ui.code('CCCC3333DDDD');
  await ui.press('Kontakt suchen');
  expect(executeFriendCommand).not.toHaveBeenCalled();
  await ui.press('Annehmen');
  expect(executeFriendCommand).toHaveBeenCalledWith(
    actor,
    expect.objectContaining({
      action: 'accept',
      referenceId: '10000000-0000-4000-8000-000000000001',
    }),
  );
  await act(async () => ui.view.unmount());
});
it('preserves a failed search input and permits retry', async () => {
  jest
    .mocked(findFriend)
    .mockRejectedValueOnce(Error('Offline'))
    .mockResolvedValueOnce(found);
  const ui = await mount();
  await ui.press('Freund hinzufügen');
  await ui.code('CCCC3333DDDD');
  await ui.press('Kontakt suchen');
  expect(JSON.stringify(ui.view.toJSON())).toContain('Offline');
  await ui.press('Kontakt suchen');
  expect(findFriend).toHaveBeenLastCalledWith(actor, 'CCCC3333DDDD');
  expect(JSON.stringify(ui.view.toJSON())).toContain('Kontakt Anna');
  await act(async () => ui.view.unmount());
});
it('ignores late search results after the user enters a different code', async () => {
  let resolve!: (v: FriendSearch) => void;
  jest
    .mocked(findFriend)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce({
      ...found,
      entry: {
        ...entry,
        profile: { ...entry.profile, displayName: 'Kontakt Neu' },
      },
    });
  const ui = await mount();
  await ui.press('Freund hinzufügen');
  await ui.code('CCCC3333DDDD');
  let task: Promise<void>;
  await act(async () => {
    task = ui.button('Kontakt suchen').props.onPress();
  });
  await ui.code('EEEE4444FFFF');
  await ui.press('Kontakt suchen');
  await act(async () => {
    resolve(found);
    await task;
  });
  expect(JSON.stringify(ui.view.toJSON())).toContain('Kontakt Neu');
  expect(JSON.stringify(ui.view.toJSON())).not.toContain('Kontakt Anna');
  await act(async () => ui.view.unmount());
});
it('requires block confirmation and explains that existing table rights remain', async () => {
  jest
    .mocked(readFriends)
    .mockResolvedValue({ ...initial, friends: [{ ...entry, pairVersion: 2 }] });
  const ui = await mount();
  await ui.press('Blockieren');
  expect(executeFriendCommand).not.toHaveBeenCalled();
  expect(JSON.stringify(ui.view.toJSON())).toContain(
    'Tischrechte bleiben erhalten',
  );
  await ui.press('Jetzt blockieren');
  expect(executeFriendCommand).toHaveBeenCalledWith(
    actor,
    expect.objectContaining({ action: 'block', targetId: target }),
  );
  await act(async () => ui.view.unmount());
});
it('restores an unresolved operation and retries exactly its persisted ID', async () => {
  const pending = {
    action: 'block' as const,
    targetId: target,
    expectedVersion: 2,
    referenceId: null,
    code: null,
    operationId: '40000000-0000-4000-8000-000000000001',
  };
  jest.mocked(readFriendOperation).mockResolvedValue(pending);
  const ui = await mount();
  expect(JSON.stringify(ui.view.toJSON())).toContain(
    'noch nicht abschließend bestätigt',
  );
  await ui.press('Auftrag prüfen');
  expect(executeFriendCommand).toHaveBeenCalledWith(actor, pending);
  await act(async () => ui.view.unmount());
});
it('keeps uncertain mutations recoverable and disables new contact changes', async () => {
  jest
    .mocked(readFriends)
    .mockResolvedValue({ ...initial, friends: [{ ...entry, pairVersion: 2 }] });
  jest
    .mocked(executeFriendCommand)
    .mockImplementationOnce(async (_a, command) => {
      throw new FriendError(
        'Antwort verloren',
        'NETWORK',
        true,
        undefined,
        command,
      );
    })
    .mockResolvedValueOnce({ ...initial, version: 2 });
  const ui = await mount();
  await ui.press('Freund entfernen');
  await ui.press('Jetzt entfernen');
  expect(JSON.stringify(ui.view.toJSON())).toContain('Antwort verloren');
  const original = jest.mocked(executeFriendCommand).mock.calls[0][1];
  await ui.press('Schließen');
  await ui.press('Auftrag prüfen');
  expect(jest.mocked(executeFriendCommand).mock.calls[1][1]).toEqual(original);
  await act(async () => ui.view.unmount());
});
it('hides old-account list and search data immediately on account change', async () => {
  const ui = await mount();
  await ui.press('Freund hinzufügen');
  await ui.code('CCCC3333DDDD');
  await ui.press('Kontakt suchen');
  await act(async () =>
    useAuthStore.setState({ user: { id: target } as never }),
  );
  const json = JSON.stringify(ui.view.toJSON());
  expect(json).not.toContain('Kontakt Anna');
  expect(json).not.toContain('AAAA-2222-BBBB');
  expect(json).toContain('Konto hat sich geändert');
  await act(async () => ui.view.unmount());
});
