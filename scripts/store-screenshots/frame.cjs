const { chromium } = require('playwright');
const fs = require('fs');
const root = process.cwd() + '/';
const font = (w) =>
  'data:font/ttf;base64,' +
  fs
    .readFileSync(
      root + `node_modules/@expo-google-fonts/inter/${w}/Inter_${w}.ttf`,
    )
    .toString('base64');
const items = [
  [
    '1-tisch',
    'Jedes Spiel sofort verrechnet',
    'Offene Beträge, Geber und Leger auf einen Blick',
  ],
  [
    '2-eingabe',
    'In Sekunden eingetragen',
    'Spieler antippen, Ergebnis wählen, fertig',
  ],
  [
    '4-abrechnung',
    'Am Ende fair abrechnen',
    'Die kürzeste Liste: wer zahlt wem wie viel',
  ],
  [
    '3-verlauf',
    'Jede Runde nachvollziehbar',
    'Korrigieren, löschen und wiederherstellen',
  ],
  ['6-regeln', 'Eure Hausregeln', 'Spielarten und Tarife in 10-Cent-Schritten'],
  [
    '5-statistik',
    'Statistik für den Stammtisch',
    'Spielarten, Gewinnquoten und Bilanz',
  ],
];
const sizes = [
  {
    dir: 'apple-6.9',
    w: 1290,
    h: 2796,
    title: 96,
    sub: 52,
    top: 190,
    shotH: 2160,
  },
  {
    dir: 'google-phone',
    w: 1080,
    h: 1920,
    title: 72,
    sub: 40,
    top: 96,
    shotH: 1580,
  },
];
(async () => {
  const b = await chromium.launch();
  for (const s of sizes) {
    const p = await b.newPage({ viewport: { width: s.w, height: s.h } });
    for (const [i, [file, title, sub]] of items.entries()) {
      const img =
        'data:image/png;base64,' +
        fs
          .readFileSync(
            require('path').join(
              process.cwd(),
              'scripts/store-screenshots/.raw',
            ) +
              '/' +
              file +
              '.png',
          )
          .toString('base64');
      const shotW = Math.round((s.shotH * 1290) / 2796);
      await p.setContent(`<!doctype html><html><head><style>
        @font-face{font-family:I;font-weight:700;src:url(${font('700Bold')})}
        @font-face{font-family:I;font-weight:500;src:url(${font('500Medium')})}
        body{margin:0;width:${s.w}px;height:${s.h}px;overflow:hidden;font-family:I;
          background:radial-gradient(circle at 50% 18%, #17301f 0%, #07110B 62%);color:#F5F5F5;text-align:center}
        h1{font-weight:700;font-size:${s.title}px;line-height:1.08;margin:${s.top}px ${s.w * 0.07}px 0;color:#F2C94C;letter-spacing:-0.01em}
        p{font-weight:500;font-size:${s.sub}px;margin:${s.sub * 0.55}px ${s.w * 0.08}px 0;color:rgba(245,245,245,.78)}
        img{position:absolute;left:50%;bottom:-${Math.round(s.shotH * 0.02)}px;transform:translateX(-50%);width:${shotW}px;height:${s.shotH}px;
          border-radius:${s.w * 0.05}px ${s.w * 0.05}px 0 0;border:${Math.max(3, s.w / 320)}px solid rgba(212,175,55,.45);border-bottom:0;
          box-shadow:0 0 ${s.w * 0.08}px rgba(212,175,55,.18)}
      </style></head><body><h1>${title}</h1><p>${sub}</p><img src="${img}"></body></html>`);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(150);
      const name = `${root}store-screenshots/${s.dir}/${i + 1}-${file.replace(/^\d-/, '')}.png`;
      await p.screenshot({ path: name });
    }
    await p.close();
  }
  await b.close();
})();
