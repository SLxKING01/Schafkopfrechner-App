import type { ProfileFields } from '../types/profile';
import {
  birthDateFromInput,
  birthDateInput,
  validateProfile,
} from '../utils/profile';
import { stripJpegMetadata } from '../utils/profilePhoto';
const fields: ProfileFields = {
  displayName: 'Simon',
  firstName: '',
  lastName: '',
  birthDate: null,
  avatarKind: 'none',
  animalId: null,
  accentId: 'forestGreen',
  photoPath: null,
  setupCompleted: true,
};
it('accepts optional private fields and international names without imposing name uniqueness', () => {
  expect(
    validateProfile({
      ...fields,
      firstName: 'Zoë-Marie',
      lastName: 'O’Connor 李',
    }),
  ).toEqual({});
  expect(validateProfile({ ...fields, displayName: 'Simon' })).toEqual({});
});
it.each(['2001-02-29', '2026-04-31', '0000-01-01', 'abcd', '2026-2-3'])(
  'rejects invalid birthday %s',
  (birthDate) => {
    expect(
      validateProfile({ ...fields, birthDate }, new Date(2026, 10, 2))
        .birthDate,
    ).toBeTruthy();
  },
);
it('accepts a leap day, today and clearing, but rejects future dates', () => {
  expect(
    validateProfile(
      { ...fields, birthDate: '2000-02-29' },
      new Date(2026, 10, 2),
    ),
  ).toEqual({});
  expect(
    validateProfile(
      { ...fields, birthDate: '2026-11-02' },
      new Date(2026, 10, 2),
    ),
  ).toEqual({});
  expect(
    validateProfile(
      { ...fields, birthDate: '2026-11-03' },
      new Date(2026, 10, 2),
    ).birthDate,
  ).toBeTruthy();
  expect(birthDateFromInput('29.02.2000')).toBe('2000-02-29');
  expect(birthDateFromInput('')).toBeNull();
  expect(birthDateInput('2000-02-29')).toBe('29.02.2000');
});
it('rejects control characters and handles unicode name length', () => {
  expect(
    validateProfile({ ...fields, displayName: 'A' }).displayName,
  ).toBeTruthy();
  expect(
    validateProfile({ ...fields, displayName: 'A\nB' }).displayName,
  ).toBeTruthy();
  expect(validateProfile({ ...fields, displayName: '🦊'.repeat(40) })).toEqual(
    {},
  );
  expect(
    validateProfile({ ...fields, displayName: '🦊'.repeat(41) }).displayName,
  ).toBeTruthy();
});
it('removes EXIF GPS, XMP, IPTC and comments while preserving the encoded image', () => {
  const header = [0xff, 0xd8],
    exif = [
      0xff,
      0xe1,
      0,
      10,
      ...Array.from('ExifGPS!').map((c) => c.charCodeAt(0)),
    ],
    iptc = [0xff, 0xed, 0, 6, 1, 2, 3, 4],
    comment = [0xff, 0xfe, 0, 4, 1, 2],
    pixels = [0xff, 0xda, 0, 2, 21, 22, 23, 0xff, 0xd9];
  const result = stripJpegMetadata(
    Uint8Array.from([...header, ...exif, ...iptc, ...comment, ...pixels]),
  );
  expect([...result]).toEqual([...header, ...pixels]);
});
it('rejects malformed jpeg lengths and incomplete images', () => {
  expect(() =>
    stripJpegMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0, 50, 1])),
  ).toThrow();
  expect(() =>
    stripJpegMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 1])),
  ).toThrow();
});
