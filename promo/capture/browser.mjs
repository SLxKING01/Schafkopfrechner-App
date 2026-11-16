import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

export const VIEWPORT = { width: 430, height: 932 };
export const INSETS = { top: 59, bottom: 34 };

const html = (base) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
<title>Schafkopfrechner</title>
<style>html,body{height:100%;margin:0;background:#07110B}body{overflow:hidden}#root{display:flex;height:100%;flex:1}</style>
</head><body><div id="root"></div>
<script src="${base}/promo/capture/entry.bundle?platform=web&dev=false&minify=false"></script>
</body></html>`;

export async function launch() {
  return chromium.launch();
}

/** Ein „Handy“: eigener Browser-Kontext mit iPhone-Viewport und Safe-Area. */
export async function openPhone(browser, backend, user, { base, scale = 3, storageState }) {
  const context = await browser.newContext({
    storageState,
    viewport: VIEWPORT,
    deviceScaleFactor: scale,
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  await backend.attach(context, user);
  await context.route(`${base}/promo.html`, (route) =>
    route.fulfill({ contentType: 'text/html', body: html(base) }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const cdp = await context.newCDPSession(page);
  await cdp
    .send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: INSETS.top, bottom: INSETS.bottom, left: 0, right: 0 },
    })
    .catch((e) => errors.push('safe-area: ' + e.message));
  return { context, page, errors };
}
