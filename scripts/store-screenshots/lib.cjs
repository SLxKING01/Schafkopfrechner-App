const { chromium } = require('playwright');
exports.open = async (opts = {}) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: opts.scale || 1,
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  });
  if (opts.clock)
    await ctx.clock.install({ time: new Date('2026-11-13T19:42:00+01:00') });
  await ctx.route('**/*', (r) =>
    new URL(r.request().url()).hostname === 'localhost'
      ? r.continue()
      : r.abort(),
  );
  if (opts.state)
    await ctx.addInitScript((s) => {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, opts.state);
  if (opts.auth)
    await ctx.addInitScript(() => {
      const expires = Math.floor(Date.now() / 1000) + 86400;
      const token =
        btoa(JSON.stringify({ alg: 'none' })) +
        '.' +
        btoa(
          JSON.stringify({
            sub: '00000000-0000-4000-8000-000000000001',
            exp: expires,
          }),
        ) +
        '.test';
      const key =
        Object.keys(localStorage).find((k) => k.endsWith('-auth-token')) ||
        'sb-jujvkphobubxmylekkvd-auth-token';
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: token,
          refresh_token: 'x',
          token_type: 'bearer',
          expires_in: 86400,
          expires_at: expires,
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'simon@example.invalid',
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: { username: 'Simon' },
            created_at: '2026-10-24',
          },
        }),
      );
    });
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  await p.goto('http://localhost:8099/?preview=off', {
    waitUntil: 'networkidle',
  });
  return { b, ctx, p };
};
exports.dump = async (p, name) => {
  await p.waitForTimeout(1200);
  await p.screenshot({
    path: `${process.cwd()}/scripts/store-screenshots/.debug-${name}.png`,
  });
  console.log(
    `--- ${name}\n` + (await p.locator('body').innerText()).slice(0, 1500),
  );
};
