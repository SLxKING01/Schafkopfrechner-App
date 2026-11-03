import {
  ANIMAL_AVATAR_IDS,
  PROFILE_ACCENTS,
} from '../constants/profileCustomization';
import type { AuthUser } from '../types/auth';
import type { OwnProfile, ProfileCard, ProfileFields } from '../types/profile';

export function legacyDisplayName(user: AuthUser | null) {
  return (
    [user?.user_metadata?.username, user?.user_metadata?.display_name]
      .find(
        (value): value is string => typeof value === 'string' && !!value.trim(),
      )
      ?.trim() ?? (user ? 'Spieler' : 'Gast')
  );
}

export function profileFields(profile: OwnProfile): ProfileFields {
  const {
    displayName,
    firstName,
    lastName,
    birthDate,
    avatarKind,
    animalId,
    accentId,
    photoPath,
  } = profile;
  return {
    displayName,
    firstName,
    lastName,
    birthDate,
    avatarKind,
    animalId,
    accentId,
    photoPath,
    setupCompleted: true,
  };
}

export function birthDateFromInput(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const german = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  return german ? `${german[3]}-${german[2]}-${german[1]}` : value;
}
export function birthDateInput(value: string | null) {
  return value ? value.split('-').reverse().join('.') : '';
}

export function validateProfile(
  fields: ProfileFields,
  today = new Date(),
): Partial<Record<keyof ProfileFields, string>> {
  const errors: Partial<Record<keyof ProfileFields, string>> = {};
  for (const [key, maximum, minimum] of [
    ['displayName', 40, 2],
    ['firstName', 80, 0],
    ['lastName', 80, 0],
  ] as const) {
    const value = fields[key].trim();
    if (
      [...value].length < minimum ||
      [...value].length > maximum ||
      /[\u0000-\u001f\u007f-\u009f]/.test(value)
    )
      errors[key] =
        key === 'displayName'
          ? 'Bitte einen Anzeigenamen mit 2 bis 40 Zeichen ohne Zeilenumbrüche eingeben.'
          : 'Bitte höchstens 80 Zeichen ohne Zeilenumbrüche eingeben.';
  }
  if (fields.birthDate) {
    const date = fields.birthDate;
    const parsed = new Date(`${date}T12:00:00Z`);
    const now = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < '0001-01-01' ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      errors.birthDate = 'Bitte ein gültiges Datum als TT.MM.JJJJ eingeben.';
    else if (date > now)
      errors.birthDate = 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
  }
  return errors;
}

export function isProfileCard(value: unknown): value is ProfileCard {
  if (!value || typeof value !== 'object') return false;
  const p = value as ProfileCard;
  return (
    typeof p.id === 'string' &&
    typeof p.displayName === 'string' &&
    ['none', 'animal', 'photo'].includes(p.avatarKind) &&
    Object.hasOwn(PROFILE_ACCENTS, p.accentId) &&
    (p.animalId === null || ANIMAL_AVATAR_IDS.includes(p.animalId)) &&
    (p.avatarKind !== 'animal' || !!p.animalId) &&
    (p.avatarKind === 'photo'
      ? typeof p.photoPath === 'string' &&
        new RegExp(`^${p.id}/[0-9a-f-]{36}\\.jpg$`).test(p.photoPath)
      : p.photoPath === null) &&
    Number.isSafeInteger(p.version) &&
    p.version > 0
  );
}
export function isOwnProfile(value: unknown): value is OwnProfile {
  if (!isProfileCard(value)) return false;
  const p = value as OwnProfile;
  return (
    typeof p.firstName === 'string' &&
    typeof p.lastName === 'string' &&
    (p.birthDate === null || typeof p.birthDate === 'string') &&
    typeof p.setupCompleted === 'boolean' &&
    typeof p.updatedAt === 'string'
  );
}
