/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

it('renders card suits as icons instead of platform-dependent Unicode glyphs', () => {
  const source = join(__dirname, '..');
  const cardSuitGlyph =
    /[\u2660-\u2667]|\\u(?:266[0-7]|\{0*266[0-7]\})|&#(?:x0*266[0-7]|0*982[4-9]|0*983[01]);/i;
  const files = readdirSync(source, { recursive: true, encoding: 'utf8' });
  const offenders = files.filter(
    (file) =>
      /\.[jt]sx$/.test(file) &&
      !file.split(/[\\/]/).includes('__tests__') &&
      cardSuitGlyph.test(readFileSync(join(source, file), 'utf8')),
  );
  expect(offenders).toEqual([]);
});
