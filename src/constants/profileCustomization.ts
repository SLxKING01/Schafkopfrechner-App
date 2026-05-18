import type {
  AnimalAvatarId,
  FriendProfile,
  ProfileAccentId,
  UserAppearance,
} from '../types/profile';

export const PROFILE_ACCENTS: Record<ProfileAccentId, string> = {
  darkGreen: '#274638',
  amber: '#B8923C',
  warmRed: '#A6524B',
  mutedBlue: '#4B6478',
  bronze: '#8B6742',
  forestGreen: '#3F6B48',
};

export const DEFAULT_USER_APPEARANCE: UserAppearance = {
  accentColor: PROFILE_ACCENTS.forestGreen,
  accentId: 'forestGreen',
  avatarId: 'fox',
};

export const ANIMAL_AVATAR_IDS: AnimalAvatarId[] = [
  'fox',
  'bear',
  'owl',
  'wolf',
  'deer',
  'raccoon',
  'rabbit',
  'boar',
];

export const FRIEND_PREVIEWS: FriendProfile[] = [
  {
    accentColor: PROFILE_ACCENTS.amber,
    avatarId: 'bear',
    id: 'friend-berkay',
    isOnline: true,
    username: 'Berkay',
  },
  {
    accentColor: PROFILE_ACCENTS.mutedBlue,
    avatarId: 'owl',
    id: 'friend-flo',
    isOnline: true,
    username: 'Flo',
  },
  {
    accentColor: PROFILE_ACCENTS.warmRed,
    avatarId: 'wolf',
    id: 'friend-alessandro',
    username: 'Alessandro',
  },
  {
    accentColor: PROFILE_ACCENTS.bronze,
    avatarId: 'deer',
    id: 'friend-max',
    isOnline: true,
    username: 'Max',
  },
  {
    accentColor: PROFILE_ACCENTS.darkGreen,
    avatarId: 'rabbit',
    id: 'friend-anna',
    username: 'Anna',
  },
];
