import { buildLegalLinks, validLegalUrl } from '../constants/legal';

test('accepts only https URLs', () => {
  expect(validLegalUrl('https://example.com/datenschutz')).toBe(
    'https://example.com/datenschutz',
  );
  expect(validLegalUrl('http://example.com')).toBeNull();
  expect(validLegalUrl('kein link')).toBeNull();
  expect(validLegalUrl(undefined)).toBeNull();
});

test('lists configured links in order and leaves out missing ones', () => {
  expect(
    buildLegalLinks({
      privacy: 'https://example.com/datenschutz',
      imprint: 'https://example.com/impressum',
    }).map((link) => link.title),
  ).toEqual(['Datenschutz', 'Impressum']);
  expect(
    buildLegalLinks({ imprint: 'https://example.com/impressum' }).map(
      (link) => link.key,
    ),
  ).toEqual(['imprint']);
  expect(buildLegalLinks({})).toEqual([]);
});
