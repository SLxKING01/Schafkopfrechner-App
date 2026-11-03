import {
  formatFriendCode,
  isFriendSearch,
  isFriendsState,
  normalizeFriendCode,
  validFriendCode,
} from '../utils/friends';
const actor = '00000000-0000-4000-8000-000000000001';
const state = {
  userId: actor,
  version: 1,
  code: 'AAAA2222BBBB',
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
};
it('normalizes complete codes without accepting partial, ambiguous or injected input', () => {
  expect(normalizeFriendCode(' aaaa-2222 bbbb ')).toBe('AAAA2222BBBB');
  expect(formatFriendCode('aaaa2222bbbb')).toBe('AAAA-2222-BBBB');
  expect(validFriendCode('aaaa-2222-bbbb')).toBe(true);
  for (const code of [
    'AAAA2222',
    'IIII2222OOOO',
    "AAAA2222BBBB';",
    'AAAA2222BBBBCCCC',
  ])
    expect(validFriendCode(code)).toBe(false);
});
it('validates owned state and prevents conflicting list membership', () => {
  expect(isFriendsState(state)).toBe(true);
  const entry = {
    profile: {
      id: '00000000-0000-4000-8000-000000000002',
      displayName: 'Gleicher Name',
      avatarKind: 'none',
      animalId: null,
      photoPath: null,
      accentId: 'forestGreen',
      version: 1,
    },
    pairVersion: 1,
    requestId: '10000000-0000-4000-8000-000000000001',
    blockId: null,
  };
  expect(isFriendsState({ ...state, incoming: [entry] })).toBe(true);
  expect(
    isFriendsState({ ...state, incoming: [entry], friends: [entry] }),
  ).toBe(false);
  expect(isFriendsState({ ...state, blocked: [entry] })).toBe(false);
  expect(
    isFriendsState({ ...state, incoming: [{ ...entry, requestId: null }] }),
  ).toBe(false);
  expect(
    isFriendsState({
      ...state,
      friends: [{ ...entry, profile: { ...entry.profile, id: actor } }],
    }),
  ).toBe(false);
});
it('does not accept fake or malformed search identities', () => {
  expect(
    isFriendSearch({
      userId: actor,
      status: 'not_found',
      entry: null,
      relation: null,
    }),
  ).toBe(true);
  expect(
    isFriendSearch({
      userId: actor,
      status: 'found',
      entry: null,
      relation: 'none',
    }),
  ).toBe(false);
  expect(
    isFriendSearch({
      userId: actor,
      status: 'not_found',
      entry: { profile: { id: actor } },
      relation: null,
    }),
  ).toBe(false);
});
