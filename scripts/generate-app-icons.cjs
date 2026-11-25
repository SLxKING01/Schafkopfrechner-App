// Renders the app icons from assets/brand/logo-mark.svg.
// Needs Playwright (Chromium) and Python with Pillow:  node scripts/generate-app-icons.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assets = path.join(root, 'assets');
const mark = fs
  .readFileSync(path.join(assets, 'brand', 'logo-mark.svg'), 'utf8')
  .replace(/<!--[\s\S]*?-->/, '');
const BG = '#07110B';
const GOLD = '#D4AF37';

// size: canvas px; disc: circle diameter as share of canvas (0 = no circle);
// markScale: how much larger the mark is drawn than the disc (the mark's viewBox is the disc).
function page({ size, background, disc, ring, color, glow, markScale = 1 }) {
  const d = size * disc;
  const markPx = d ? d : size * 0.62;
  const drawPx = markPx * markScale;
  return `<!doctype html><html><body style="margin:0">
  <div style="width:${size}px;height:${size}px;display:grid;place-items:center;position:relative;
    background:${background};overflow:hidden">
    ${glow ? `<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 42%, rgba(212,175,55,0.16), transparent 62%)"></div>` : ''}
    <div style="position:relative;width:${markPx}px;height:${markPx}px;border-radius:50%;
      ${disc ? `background:#0D1B13;box-shadow:0 0 0 ${Math.max(1, size / 160)}px ${ring}, 0 ${size / 40}px ${size / 12}px rgba(212,175,55,0.18);` : ''}
      color:${color};display:grid;place-items:center">
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${drawPx}px;height:${drawPx}px">${mark.replace('<svg ', `<svg width="${drawPx}" height="${drawPx}" `)}</div>
    </div>
  </div></body></html>`;
}

const outputs = [
  // iOS / default icon: opaque, full bleed.
  {
    file: 'icon.png',
    size: 1024,
    background: BG,
    disc: 0.7,
    ring: 'rgba(212,175,55,0.45)',
    color: GOLD,
    glow: true,
    opaque: true,
  },
  // Android adaptive: the launcher crops to the inner ~66 %, so stay inside it.
  {
    file: 'android-icon-foreground.png',
    size: 512,
    background: 'transparent',
    disc: 0.56,
    ring: 'rgba(212,175,55,0.45)',
    color: GOLD,
  },
  {
    file: 'android-icon-background.png',
    size: 512,
    background: BG,
    disc: 0,
    color: 'transparent',
    solid: true,
  },
  {
    file: 'android-icon-monochrome.png',
    size: 432,
    background: 'transparent',
    disc: 0,
    color: '#FFFFFF',
    markOnly: 0.5,
  },
  // Splash: transparent, drawn on the configured #07110B background.
  {
    file: 'splash-icon.png',
    size: 1024,
    background: 'transparent',
    disc: 0.6,
    ring: 'rgba(212,175,55,0.38)',
    color: GOLD,
  },
  {
    file: 'favicon.png',
    size: 48,
    background: BG,
    disc: 0.92,
    ring: 'rgba(212,175,55,0.55)',
    color: GOLD,
    opaque: true,
    markScale: 1.2,
  },
];

(async () => {
  // PW_CHANNEL=msedge uses the installed Edge instead of a downloaded Chromium.
  const browser = await chromium.launch(
    process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {},
  );
  for (const o of outputs) {
    const p = await browser.newPage({
      viewport: { width: o.size, height: o.size },
    });
    const html = o.solid
      ? `<body style="margin:0;background:${BG};width:${o.size}px;height:${o.size}px"></body>`
      : o.markOnly
        ? `<body style="margin:0;display:grid;place-items:center;width:${o.size}px;height:${o.size}px;color:${o.color}">${mark.replace('<svg ', `<svg width="${o.size * o.markOnly * 1.6}" height="${o.size * o.markOnly * 1.6}" `)}</body>`
        : page(o);
    await p.setContent(html);
    const target = path.join(assets, o.file);
    await p.screenshot({ path: target, omitBackground: !o.opaque && !o.solid });
    await p.close();
    if (o.opaque || o.solid)
      execFileSync(process.env.PYTHON || 'python3', [
        '-c',
        'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[1])',
        target,
      ]);
    console.log('wrote', o.file);
  }
  await browser.close();
})();
