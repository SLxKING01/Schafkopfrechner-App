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
  avatarKind?: 'none' | 'animal' | 'photo';
  photoPath?: string | null;
  accentId?: ProfileAccentId;
};

export type ProfileCard = {
  id: string;
  displayName: string;
  avatarKind: 'none' | 'animal' | 'photo';
  animalId: AnimalAvatarId | null;
  accentId: ProfileAccentId;
  photoPath: string | null;
  version: number;
};
export type OwnProfile = ProfileCard & {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  setupCompleted: boolean;
  updatedAt: string;
};
export type ProfileFields = Omit<OwnProfile, 'id' | 'version' | 'updatedAt'>;
export type ProfileDraft = {
  fields: ProfileFields;
  version: number;
  operationId: string;
  photoUri?: string;
  photoBase64?: string;
  uncertain?: boolean;
};
