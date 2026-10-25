const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const fs = require('fs');
const testUrl = process.env.MOBILE_TEST_URL || 'http://localhost:8083';
const assert = require('node:assert/strict');
const path = require('path');
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.MOBILE_BROWSER_PATH ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  await context.route('**/*', (r) =>
    new URL(r.request().url()).hostname === 'localhost'
      ? r.continue()
      : r.abort(),
  );
  await context.addInitScript(() => {
    if (!localStorage.getItem('sb-audit-auth-token')) {
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
      localStorage.setItem(
        'sb-audit-auth-token',
        JSON.stringify({
          access_token: token,
          refresh_token: 'test-only',
          token_type: 'bearer',
          expires_in: 86400,
          expires_at: expires,
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'audit@example.invalid',
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: { username: 'Audit' },
            created_at: '2026-10-24',
          },
        }),
      );
    }
  });
  const page = await context.newPage();
  globalThis.testPage = page;
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(testUrl);
  await page.getByText('Aktueller Tisch', { exact: true }).waitFor();

  const out = path.resolve(
    'design-previews/ux-audit-2026-10-23/acceptance-2026-10-25',
  );
  fs.mkdirSync(out, { recursive: true });
  await page.screenshot({
    path: path.join(out, 'dashboard-empty-390x568.png'),
  });
  await page.getByRole('button', { name: /Neues Spiel/ }).click();
  await page
    .getByPlaceholder('z. B. Freitag Stammtisch')
    .fill('Freitag mit langen Namen');
  for (const name of [
    'Anna mit sehr langem Nachnamen',
    'Max',
    'Flo',
    'Julia',
    'Berkay',
    'Lukas',
    'Tom',
  ]) {
    await page.getByPlaceholder('Spielername', { exact: true }).fill(name);
    await page
      .getByRole('button', { name: 'Spieler zum Tisch hinzufuegen' })
      .click();
  }
  await page
    .getByRole('button', { name: 'Tisch erstellen', exact: true })
    .click();
  await page.getByRole('button', { name: /Runde hinzuf/ }).waitFor();
  await page.getByRole('button', { name: /Runde hinzuf/ }).click();
  await page
    .getByRole('button', { name: /^Audit als Gewinner/ })
    .first()
    .click();
  await page
    .getByRole('button', {
      name: /^Anna mit sehr langem Nachnamen als Gewinner/,
    })
    .last()
    .click();
  await page.getByRole('button', { name: /^Max als Verlierer/ }).click();
  await page.getByRole('button', { name: /^Flo als Verlierer/ }).click();
  await page
    .getByRole('textbox', { name: 'Betrag', exact: true })
    .fill('10,01');
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'party-preview-390x568.png') });
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .click();

  const report = {
    date: '2026-10-25',
    browser: 'Installed Microsoft Edge, headless mobile emulation',
    authentication:
      'Synthetic local session only; audit.invalid is blocked. Not a real login test.',
    widths: [360, 390, 430],
    shortViewport: [390, 568],
    errors,
    checks: [],
  };
  const disk = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem('schafkopfrechner-games')).state,
    );
  const snap = async (name) => {
    assert(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <=
        page.viewportSize().width,
      `Horizontal overflow: ${name}`,
    );
    await page.screenshot({ path: path.join(out, name + '.png') });
    report.checks.push({
      screenshot: name,
      viewport: page.viewportSize(),
      docWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    });
    fs.writeFileSync(
      path.join(out, 'browser-results.json'),
      JSON.stringify(report, null, 2),
    );
  };
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .waitFor({ state: 'hidden' });
  let state = await disk();
  assert.equal(state.rounds.length, 1);
  assert.equal(
    state.balances.reduce((n, b) => n + Math.round(b.amount * 100), 0),
    0,
  );
  const roundId = state.rounds[0].id;
  await page.getByRole('tab', { name: 'Verlauf Tab' }).click();
  await page
    .getByRole('button', { name: /Runde bearbeiten/ })
    .first()
    .click();
  await page
    .getByRole('textbox', { name: 'Betrag', exact: true })
    .fill('12,01');
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .waitFor({ state: 'hidden' });
  state = await disk();
  assert.equal(state.rounds.length, 1);
  assert.equal(state.rounds[0].id, roundId);
  assert.equal(state.rounds[0].amount, 12.01);
  assert.equal(state.rounds[0].winnerIds.length, 2);
  for (let i = 0; i < 11; i++) {
    await page.getByRole('button', { name: /Runde hinzuf/ }).click();
    await page
      .getByRole('button', { name: /^Audit als Gewinner/ })
      .first()
      .click();
    await page
      .getByRole('button', {
        name: /^Anna mit sehr langem Nachnamen als Gewinner/,
      })
      .last()
      .click();
    await page.getByRole('button', { name: /^Max als Verlierer/ }).click();
    await page.getByRole('button', { name: /^Flo als Verlierer/ }).click();
    await page
      .getByRole('button', { name: 'Runde speichern', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Runde speichern', exact: true })
      .waitFor({ state: 'hidden' });
  }
  state = await disk();
  assert.equal(state.rounds.length, 12);
  assert.equal(state.players.length, 8);
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 568 });
    await page
      .getByRole('button', { name: 'Spieltag abschliessen', exact: true })
      .scrollIntoViewIfNeeded();
    await snap('modern-history-bottom-' + width + 'x568');
  }
  await page.setViewportSize({ width: 390, height: 568 });
  await page
    .getByRole('button', { name: /Runde bearbeiten/ })
    .first()
    .click();
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('div[dir=auto]')) {
      const size = parseFloat(getComputedStyle(element).fontSize);
      element.dataset.auditStyle = element.getAttribute('style') || '';
      element.style.setProperty('font-size', `${size * 2}px`, 'important');
      element.style.setProperty('line-height', '1.4', 'important');
    }
  });
  await page
    .getByRole('textbox', { name: 'Betrag', exact: true })
    .fill('10,00');
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .scrollIntoViewIfNeeded();
  await snap('modern-input-text-200-percent');
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .waitFor({ state: 'hidden' });
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('[data-audit-style]')) {
      element.setAttribute('style', element.dataset.auditStyle);
      delete element.dataset.auditStyle;
    }
  });
  // Reduced viewport represents keyboard space only, not an actual OS keyboard.
  await page.setViewportSize({ width: 390, height: 360 });
  await page.getByRole('button', { name: /Runde hinzuf/ }).click();
  await page.getByRole('textbox', { name: 'Betrag', exact: true }).fill('0,50');
  await page
    .getByRole('button', { name: 'Runde speichern', exact: true })
    .scrollIntoViewIfNeeded();
  await snap('modern-reduced-height-390x360');
  await page
    .getByRole('button', { name: /Rundeneingabe schlie/ })
    .last()
    .click();
  await page.setViewportSize({ width: 390, height: 568 });
  await page.getByRole('button', { name: /Zur.*ck zu Tische/ }).click();
  await page.getByRole('tab', { name: /Statistik/ }).click();
  assert(
    await page.getByText(/Anna mit sehr langem Nachnamen: 12 Siege/).count(),
  );
  await snap('modern-real-statistics');
  await page.getByRole('tab', { name: /Spielen/ }).click();
  await page
    .getByRole('button', { name: 'Freitag mit langen Namen oeffnen' })
    .click();
  await page
    .getByRole('button', { name: 'Spieltag abschliessen', exact: true })
    .click();
  await snap('modern-settlement-390x568');
  const oldId = (await disk()).currentTable.id;
  // Save failure is injected only in this disposable browser storage.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__restoreStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (k, v) {
      if (k === 'schafkopfrechner-games')
        throw new Error('Injected storage failure');
      return original.call(this, k, v);
    };
  });
  await page
    .getByRole('button', { name: 'Neuen Tisch starten', exact: true })
    .click();
  await page.getByRole('alert').waitFor();
  assert.equal((await disk()).currentTable.id, oldId);
  await snap('storage-failure-prevents-switch');
  await page.evaluate(() => window.__restoreStorage());
  await page.getByRole('button', { name: 'Erneut lokal speichern' }).click();
  await page
    .getByRole('button', { name: 'Neuen Tisch starten', exact: true })
    .click();
  await page
    .getByPlaceholder('z. B. Freitag Stammtisch')
    .fill('Samstag neuer Tisch');
  await page.getByPlaceholder('Spielername', { exact: true }).fill('Zoe');
  await page
    .getByRole('button', { name: 'Spieler zum Tisch hinzufuegen' })
    .click();
  await page
    .getByRole('button', { name: 'Tisch erstellen', exact: true })
    .click();
  await page.getByRole('button', { name: /Runde hinzuf/ }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: /Runde hinzuf/ }).waitFor();
  state = await disk();
  assert.equal(state.currentTable.name, 'Samstag neuer Tisch');
  assert.equal(state.archivedTables.length, 1);
  assert.equal(state.archivedTables[0].rounds.length, 12);
  await page.getByRole('button', { name: /Zur.*ck zu Tische/ }).click();
  await page.getByRole('tab', { name: /Dashboard/ }).click();
  await page.getByRole('button', { name: /Tischarchiv .ffnen/ }).click();
  await snap('archive-restored-after-reload');
  // Double existing text sizes without changing application sources or persisted data.
  await page.evaluate(() => {
    for (const e of document.querySelectorAll('div[dir=auto]')) {
      const size = parseFloat(getComputedStyle(e).fontSize);
      e.dataset.auditStyle = e.getAttribute('style') || '';
      e.style.setProperty('font-size', size * 2 + 'px', 'important');
      e.style.setProperty('line-height', '1.4', 'important');
    }
  });
  await page
    .getByRole('button', { name: 'Abrechnung ansehen', exact: true })
    .scrollIntoViewIfNeeded();
  await snap('archive-text-200-percent');
  await page.evaluate(() => {
    for (const e of document.querySelectorAll('[data-audit-style]')) {
      e.setAttribute('style', e.dataset.auditStyle);
      delete e.dataset.auditStyle;
    }
  });
  await page
    .getByRole('button', { name: 'Abrechnung ansehen', exact: true })
    .click();
  const before = await disk();
  await page
    .getByRole('button', { name: 'Als bezahlt markieren', exact: true })
    .first()
    .click();
  state = await disk();
  assert.deepEqual(state.balances, before.balances);
  assert.deepEqual(state.settlements, before.settlements);
  assert.equal(state.currentTable.id, before.currentTable.id);
  assert(state.archivedTables[0].settlements.some((p) => p.isPaid));
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 568 });
    await page
      .getByRole('button', { name: /Tischarchiv .ffnen/ })
      .scrollIntoViewIfNeeded();
    await snap('archived-settlement-' + width + 'x568');
  }
  report.modern = {
    players: 8,
    rounds: 12,
    editSameId: true,
    centsSum: 0,
    storageFailureBlockedSwitch: true,
    reloadRestoredArchive: true,
    archivedPaymentsIsolated: true,
    osKeyboardTest: false,
  };
  // Separate, genuinely unsigned-in profile for the existing offline game model.
  const local = await browser.newContext({
    viewport: { width: 390, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  await local.route('**/*', (r) =>
    new URL(r.request().url()).hostname === 'localhost'
      ? r.continue()
      : r.abort(),
  );
  const offline = await local.newPage();
  offline.setDefaultTimeout(10000);
  offline.on('pageerror', (e) => errors.push(e.message));
  await offline.goto(testUrl);
  await offline.getByRole('button', { name: /Ohne Account spielen/ }).click();
  await offline.getByRole('tab', { name: /Spieler/ }).click();
  for (const name of [
    'Anna langer Nachname',
    'Max',
    'Flo',
    'Julia',
    'Berkay',
    'Lukas',
    'Tom',
    'Zoe',
  ]) {
    await offline.getByPlaceholder('Spielername').fill(name);
    await offline.getByRole('button', { name: /Spieler hinzu/ }).click();
  }
  await offline.getByRole('tab', { name: /Neues Spiel/ }).click();
  await offline
    .getByRole('button', { name: 'Anna langer Nachname Gewinner', exact: true })
    .click();
  await offline
    .getByRole('button', { name: 'Max zweiter Gewinner', exact: true })
    .click();
  await offline
    .getByRole('button', { name: 'Flo Verlierer', exact: true })
    .click();
  await offline
    .getByRole('button', { name: 'Julia Verlierer', exact: true })
    .click();
  await offline
    .getByRole('button', { name: 'Spiel speichern', exact: true })
    .click();
  await offline
    .getByRole('button', { name: 'Bearbeiten', exact: true })
    .click();
  await offline.getByRole('button', { name: '+', exact: true }).click();
  await offline.getByRole('button', { name: /nderungen speichern/ }).click();
  await offline.getByRole('tab', { name: /Spieler/ }).click();
  assert(
    await offline
      .getByRole('button', { name: /Anna langer Nachname l.schen/ })
      .isDisabled(),
  );
  assert(
    await offline.getByRole('button', { name: /Max l.schen/ }).isDisabled(),
  );
  await offline.screenshot({
    path: path.join(out, 'offline-referenced-player-delete-blocked.png'),
  });
  await offline
    .getByRole('tab', { name: /Spiele/ })
    .first()
    .click();
  for (const width of [360, 390, 430]) {
    await offline.setViewportSize({ width, height: 568 });
    await offline
      .getByRole('button', { name: 'Bearbeiten', exact: true })
      .scrollIntoViewIfNeeded();
    await offline.screenshot({
      path: path.join(out, 'offline-actions-' + width + 'x568.png'),
    });
  }
  await offline.getByRole('button', { name: /Spieltag abschlie/ }).click();
  await offline
    .getByRole('button', { name: 'Neuen Spieltag starten', exact: true })
    .scrollIntoViewIfNeeded();
  await offline.screenshot({
    path: path.join(out, 'offline-close-430x568.png'),
  });
  await offline
    .getByRole('button', { name: 'Neuen Spieltag starten', exact: true })
    .click();
  await offline.getByRole('tab', { name: /Historie/ }).click();
  await offline
    .getByRole('button')
    .filter({ hasText: 'Heute' })
    .first()
    .click();
  await offline.screenshot({
    path: path.join(out, 'offline-history-both-winners.png'),
  });
  report.offline = {
    players: 8,
    partySaved: true,
    partyEdited: true,
    referencedDeletionBlocked: true,
    historyOpened: true,
  };
  const damagedContext = await browser.newContext({
    viewport: { width: 390, height: 568 },
  });
  await damagedContext.route('**/*', (r) =>
    new URL(r.request().url()).hostname === 'localhost'
      ? r.continue()
      : r.abort(),
  );
  await damagedContext.addInitScript(() => {
    localStorage.setItem('schafkopfrechner-games', '{invalid JSON');
  });
  const damagedPage = await damagedContext.newPage();
  damagedPage.on('pageerror', (e) => errors.push(e.message));
  await damagedPage.goto(testUrl);
  await damagedPage.getByRole('alert').waitFor();
  await damagedPage
    .getByRole('button', { name: 'Erneut lokal speichern' })
    .click();
  assert.equal(
    await damagedPage.evaluate(() =>
      localStorage.getItem('schafkopfrechner-games'),
    ),
    '{invalid JSON',
  );
  await damagedPage.screenshot({
    path: path.join(out, 'unreadable-save-preserved.png'),
  });
  report.unreadableSavePreserved = true;
  assert.deepEqual(errors, []);
  report.result = 'PASS';
  fs.writeFileSync(
    path.join(out, 'browser-results.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  await browser.close();
})().catch(async (e) => {
  if (globalThis.testPage)
    await globalThis.testPage
      .screenshot({ path: 'mobile-acceptance-failure.png' })
      .catch(() => {});
  console.error(e);
  process.exit(1);
});
