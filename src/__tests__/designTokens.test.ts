/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = join(__dirname, '..');

function sourceFiles() {
  return readdirSync(source, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => {
      const parts = file.split(/[\\/]/);
      return !parts.includes('__tests__') && parts[0] !== 'theme';
    })
    .map((file) => ({
      file: file.replace(/\\/g, '/'),
      text: readFileSync(join(source, file), 'utf8'),
    }));
}

function lucideNames(text: string) {
  const names: string[] = [];
  const imports = text.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*'lucide-react-native'/g,
  );
  for (const [, list] of imports) {
    for (const entry of list.split(',')) {
      const name = entry.trim();
      if (!name || name.startsWith('type ')) continue;
      const [original, alias] = name.split(/\s+as\s+/);
      names.push(alias ?? original);
    }
  }
  return names;
}

it('uses only Lucide icons', () => {
  const offenders = sourceFiles()
    .filter(({ text }) =>
      /from '(@expo\/vector-icons|react-native-vector-icons)/.test(text),
    )
    .map(({ file }) => file);
  expect(offenders).toEqual([]);
});

it('draws Lucide icons through AppIcon so sizes and strokes stay on the scale', () => {
  const offenders = sourceFiles().flatMap(({ file, text }) =>
    lucideNames(text)
      .filter((name) => new RegExp(`<${name}[\\s/>]`).test(text))
      .map((name) => `${file}: <${name}>`),
  );
  expect(offenders).toEqual([]);
});

it('takes font sizes from authTypography', () => {
  // Decorative exceptions: the lobby's watermark suit and the tiny suit label
  // that has to fit inside a 48 pt tile.
  const allowed = new Set([
    'screens/app/GameLobbyScreen.tsx: fontSize: 96',
    'screens/app/GameLobbyScreen.tsx: fontSize: 8',
  ]);
  const offenders = sourceFiles().flatMap(({ file, text }) =>
    [...text.matchAll(/fontSize: ?\d+/g)]
      .map(([match]) => `${file}: ${match.replace(/: ?/, ': ')}`)
      .filter((entry) => !allowed.has(entry)),
  );
  expect(offenders).toEqual([]);
});
