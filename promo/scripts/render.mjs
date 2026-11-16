// Rendert Standbilder, Entwurf oder das fertige Reel.
//   node scripts/render.mjs stills | draft | final [--endCard=soon|live] [--icon=app-logo|assets-icon]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

import { prepare } from './prepare.mjs';

const promo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'final';
const flag = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const inputProps = { endCard: flag('endCard', 'soon'), icon: flag('icon', 'app-logo') };
if (!['soon', 'live'].includes(inputProps.endCard)) throw new Error('endCard muss "soon" oder "live" sein.');
if (!['app-logo', 'assets-icon'].includes(inputProps.icon)) throw new Error('icon muss "app-logo" oder "assets-icon" sein.');

const { hasBadge } = prepare();
if (inputProps.endCard === 'live' && !hasBadge)
  console.warn('Hinweis: promo/assets/app-store-badge.svg fehlt. Die Schlusskarte zeigt stattdessen den Text „Jetzt im App Store“.');

// Optional einen vorhandenen Chrome verwenden (sonst lädt Remotion selbst einen).
const browserExecutable = process.env.PROMO_CHROME || undefined;
const common = { inputProps, browserExecutable, chromeMode: 'headless-shell', logLevel: 'warn' };

console.log('Bündle Video …');
const serveUrl = await bundle({
  entryPoint: path.join(promo, 'video/index.ts'),
  publicDir: path.join(promo, 'public'),
});
const out = (...parts) => {
  const file = path.join(promo, 'out', ...parts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
};

if (mode === 'stills') {
  const composition = await selectComposition({ serveUrl, id: 'Reel', ...common });
  // Ein aussagekräftiges Bild je Szene (Sekunde → Name).
  const frames = [
    [0.1, '01-hook-start'], [1.9, '01-hook-ende'], [3.5, '02-aufloesung'],
    [5.2, '03-erfassen-tisch'], [7.2, '04-erfassen-spielart'], [8.6, '05-erfassen-betrag'], [9.7, '05-erfassen-gespeichert'],
    [11.7, '06-tische-start'], [13.2, '07-tische-eintrag'], [14.6, '08-tische-live'], [15.7, '08-tische-verlauf'],
    [16.8, '09-statistik-spieler'], [19.4, '10-statistik-spielarten'], [20.6, '11-statistik-rollen'],
    [23.7, '12-slogan'], [27.5, '13-schluss'],
  ];
  for (const [second, name] of frames) {
    await renderStill({ composition, serveUrl, frame: Math.round(second * 30), output: out('stills', `${name}.png`), scale: 0.5, ...common });
    console.log('  Standbild', name);
  }
} else {
  const draft = mode === 'draft';
  const composition = await selectComposition({ serveUrl, id: 'Reel', ...common });
  const suffix = inputProps.endCard === 'live' ? '-live' : '';
  const output = draft ? out('draft', `schafkopfrechner-reel-entwurf${suffix}.mp4`) : out(`schafkopfrechner-reel${suffix}.mp4`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    pixelFormat: 'yuv420p',
    colorSpace: 'bt709',
    muted: true, // keine Tonspur – Musik kommt später in Instagram/TikTok dazu
    scale: draft ? 0.5 : 1,
    crf: draft ? 24 : 16,
    outputLocation: output,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== last) console.log(`  ${(last = percent)} %`);
    },
    ...common,
  });
  console.log('Video:', output);
  if (!draft) {
    const cover = await selectComposition({ serveUrl, id: 'Cover', ...common });
    await renderStill({ composition: cover, serveUrl, output: out('schafkopfrechner-cover.png'), ...common });
    console.log('Cover:', out('schafkopfrechner-cover.png'));
  }
}
