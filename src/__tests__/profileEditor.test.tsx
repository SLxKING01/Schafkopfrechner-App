import { act } from 'react';
import { TextInput } from 'react-native';

import { ProfileEditor } from '../screens/app/EditProfileScreen';
import { selectProfilePhoto } from '../services/profile/profilePhoto';
import { readOwnProfile, saveOwnProfile } from '../services/profile/profiles';
import {
  keepProfileDraft,
  restoreProfileDraft,
} from '../services/profile/profileStorage';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import type { OwnProfile } from '../types/profile';
const renderer = jest.requireActual('react-test-renderer');
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../services/profile/profiles', () => ({
  saveOwnProfile: jest.fn(),
  readOwnProfile: jest.fn(),
  assertProfileActor: (id: string) => {
    if (
      jest.requireActual('../store/authStore').useAuthStore.getState().user
        ?.id !== id
    )
      throw Error('Konto geändert');
  },
}));
jest.mock('../services/profile/profileStorage', () => ({
  restoreProfileDraft: jest.fn(async () => null),
  keepProfileDraft: jest.fn(async () => {}),
  removeProfileDraft: jest.fn(async () => {}),
  cacheOwnProfile: jest.fn(async () => {}),
}));
jest.mock('../services/profile/profilePhoto', () => ({
  selectProfilePhoto: jest.fn(async () => null),
  removeLocalProfilePhoto: jest.fn(),
}));
jest.mock('../components/profile/ProfileAvatar', () => ({
  ProfileAvatar: () => null,
}));
jest.mock('../components/game/AnimalAvatar', () => ({
  AnimalAvatar: () => null,
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
  return new Proxy(native, {
    get: (t, k) =>
      k === 'Modal'
        ? ({
            visible,
            children,
          }: {
            visible: boolean;
            children: React.ReactNode;
          }) => (visible ? children : null)
        : t[k],
  });
});
const initial: OwnProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Simon',
  firstName: '',
  lastName: '',
  birthDate: null,
  avatarKind: 'none',
  animalId: null,
  accentId: 'forestGreen',
  photoPath: null,
  version: 1,
  updatedAt: '2026-11-02',
  setupCompleted: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: { id: initial.id } as never });
  useProfileStore.setState({
    ownerId: initial.id,
    profile: initial,
    loading: false,
    error: null,
  });
  jest.mocked(restoreProfileDraft).mockResolvedValue(null);
});
async function mount() {
  let view: ReturnType<typeof renderer.create>;
  const done = jest.fn();
  const close = { current: () => {} };
  await act(async () => {
    view = renderer.create(
      <ProfileEditor
        initialProfile={initial}
        onDone={done}
        requestCloseRef={close}
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
  return {
    view: view!,
    done,
    close,
    button,
    press: async (label: string) => {
      await act(async () => button(label).props.onPress());
    },
    type: async (label: string, text: string) => {
      await act(async () =>
        view.root
          .findAllByType(TextInput)
          .find(
            (n: { props: { accessibilityLabel: string } }) =>
              n.props.accessibilityLabel === label,
          )!
          .props.onChangeText(text),
      );
    },
  };
}
it('retains the draft after failure and closes only after a successful retry', async () => {
  jest
    .mocked(saveOwnProfile)
    .mockRejectedValueOnce(
      Object.assign(Error('Offline'), { mayHaveCommitted: false }),
    )
    .mockResolvedValueOnce({ ...initial, firstName: 'Zoë', version: 2 });
  const ui = await mount();
  await ui.type('Vorname', 'Zoë');
  await ui.press('Profil speichern');
  expect(ui.done).not.toHaveBeenCalled();
  expect(JSON.stringify(ui.view.toJSON())).toContain(
    'Speichern nicht bestätigt',
  );
  await ui.press('Profil speichern');
  expect(jest.mocked(saveOwnProfile).mock.calls[1][1].fields.firstName).toBe(
    'Zoë',
  );
  expect(ui.done).toHaveBeenCalledTimes(1);
  await act(async () => ui.view.unmount());
});
it('shows an invalid birthday and prevents saving, while allowing removal', async () => {
  const ui = await mount();
  await ui.type('Geburtsdatum', '31.02.2000');
  expect(ui.button('Profil speichern').props.disabled).toBe(true);
  await ui.type('Geburtsdatum', '');
  expect(ui.button('Profil speichern').props.disabled).toBe(false);
  await act(async () => ui.view.unmount());
});
it('retains drafts on the common close path used by back gestures', async () => {
  const ui = await mount();
  await ui.type('Nachname', 'O’Connor');
  await act(async () => ui.close.current());
  await ui.press('Entwurf behalten');
  expect(keepProfileDraft).toHaveBeenCalledWith(
    initial.id,
    expect.objectContaining({
      fields: expect.objectContaining({ lastName: 'O’Connor' }),
    }),
  );
  expect(ui.done).toHaveBeenCalled();
  await act(async () => ui.view.unmount());
});
it('keeps photo-picker cancellation harmless', async () => {
  const ui = await mount();
  await ui.press('Foto auswählen');
  expect(selectProfilePhoto).toHaveBeenCalledWith(initial.id);
  expect(saveOwnProfile).not.toHaveBeenCalled();
  expect(useProfileStore.getState().profile?.avatarKind).toBe('none');
  await act(async () => ui.view.unmount());
});
it('shows the other device’s version and rebases only after explicit choice', async () => {
  jest
    .mocked(saveOwnProfile)
    .mockRejectedValueOnce(
      Object.assign(Error('Conflict'), {
        code: 'PT409',
        mayHaveCommitted: false,
      }),
    )
    .mockResolvedValueOnce({ ...initial, version: 3 });
  jest.mocked(readOwnProfile).mockResolvedValue({
    ...initial,
    displayName: 'Aktueller Name',
    version: 2,
  });
  const ui = await mount();
  await ui.type('Vorname', 'Eigener Entwurf');
  await ui.press('Profil speichern');
  await ui.press('Aktuellen Stand ansehen');
  expect(JSON.stringify(ui.view.toJSON())).toContain('Aktueller Name');
  await ui.press('Eigene Änderungen auf diesen Stand anwenden');
  await ui.press('Profil speichern');
  expect(jest.mocked(saveOwnProfile).mock.calls[1][1]).toMatchObject({
    version: 2,
    fields: { firstName: 'Eigener Entwurf' },
  });
  await act(async () => ui.view.unmount());
});
it('blocks duplicate submission and does not apply a delayed save after account switch', async () => {
  let resolve!: (p: OwnProfile) => void;
  jest.mocked(saveOwnProfile).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const ui = await mount();
  let first: Promise<void>;
  await act(async () => {
    first = ui.button('Profil speichern').props.onPress();
    ui.button('Profil speichern').props.onPress();
  });
  expect(saveOwnProfile).toHaveBeenCalledTimes(1);
  await act(async () => {
    useAuthStore.setState({ user: { id: 'other' } as never });
    resolve({ ...initial, version: 2 });
    await first;
  });
  expect(ui.done).not.toHaveBeenCalled();
  expect(useProfileStore.getState().profile?.version).toBe(1);
  await act(async () => ui.view.unmount());
});
