export type AnimalAvatarId =
  | 'fox'
  | 'bear'
  | 'owl'
  | 'wolf'
  | 'deer'
  | 'raccoon'
  | 'rabbit'
  | 'boar';

export type ProfileAccentId =
  | 'darkGreen'
  | 'amber'
  | 'warmRed'
  | 'mutedBlue'
  | 'bronze'
  | 'forestGreen';

export type UserAppearance = {
  avatarId: AnimalAvatarId;
  accentColor: string;
  accentId: ProfileAccentId;
};

export type FriendProfile = {
  id: string;
  username: string;
  avatarId: AnimalAvatarId;
  accentColor: string;
  isOnline?: boolean;
};
