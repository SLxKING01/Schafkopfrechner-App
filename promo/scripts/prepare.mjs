// Bereitet die Eingaben für Remotion vor: Screenshots, App-Schrift (Inter),
// App-Icon, Farbsymbole und – falls vorhanden – das App-Store-Badge.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const promo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.resolve(promo, '..');
const pub = path.join(promo, 'public');
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

export function prepare() {
  const shotsDir = path.join(promo, 'out/screenshots');
  const metaFile = path.join(shotsDir, 'shots.json');
  if (!fs.existsSync(metaFile))
    throw new Error('Keine Screenshots gefunden. Bitte zuerst `npm run capture` ausführen.');
  const shots = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  for (const file of Object.values(shots.shots))
    copy(path.join(shotsDir, file), path.join(pub, 'shots', file));

  for (const [weight, name] of Object.entries({
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
    800: 'Inter_800ExtraBold',
    900: 'Inter_900Black',
  })) {
    const dir = name.replace('Inter_', '');
    copy(
      path.join(app, 'node_modules/@expo-google-fonts/inter', dir, `${name}.ttf`),
      path.join(pub, 'fonts', `Inter-${weight}.ttf`),
    );
  }
  copy(path.join(app, 'assets/icon.png'), path.join(pub, 'icon.png'));

  // Offizielles Badge nur verwenden, wenn die Datei wirklich da ist.
  const badge = path.join(promo, 'assets/app-store-badge.svg');
  const hasBadge = fs.existsSync(badge) && fs.statSync(badge).size > 0;
  const badgeTarget = path.join(pub, 'app-store-badge.svg');
  if (hasBadge) copy(badge, badgeTarget);
  else fs.rmSync(badgeTarget, { force: true });

  // Farbsymbole und Farben direkt aus dem App-Code lesen (eine Quelle der Wahrheit).
  const iconSource = fs.readFileSync(path.join(app, 'src/components/game/CardSuitIcon.tsx'), 'utf8');
  const block = iconSource.slice(iconSource.indexOf('CARD_SUIT_PATHS'), iconSource.indexOf('};'));
  const suitPaths = Object.fromEntries(
    [...block.matchAll(/(eichel|gras|herz|schellen):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]),
  );
  const suitSource = fs.readFileSync(path.join(app, 'src/utils/cardSuits.ts'), 'utf8');
  const suits = [...suitSource.matchAll(/id: '(\w+)', label: '(\w+)', color: '(#[0-9A-Fa-f]{6})'/g)].map(
    (m) => ({ id: m[1], label: m[2], color: m[3], path: suitPaths[m[1]] }),
  );
  if (suits.length !== 4 || suits.some((s) => !s.path))
    throw new Error('Farbsymbole konnten nicht aus dem App-Code gelesen werden.');

  fs.mkdirSync(path.join(promo, 'video/generated'), { recursive: true });
  fs.writeFileSync(
    path.join(promo, 'video/generated/tokens.json'),
    JSON.stringify({ suits, hasBadge, viewport: shots.viewport, taps: shots.taps, boxes: shots.boxes }, null, 2) + '\n',
  );
  return { hasBadge };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { hasBadge } = prepare();
  console.log(`Vorbereitet. App-Store-Badge ${hasBadge ? 'gefunden' : 'nicht vorhanden (Textvariante)'}.`);
}
