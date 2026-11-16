// Erzeugt alle App-Screenshots für das Werbevideo und den App-Store-Eintrag.
// Aufruf über `npm run capture` (startet den Expo-Webserver selbst), siehe README.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INSETS, launch, openPhone, VIEWPORT } from './browser.mjs';
import { users } from './demo-data.mjs';
import { createBackend } from './mock-backend.mjs';
import { seedDemo } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../out/screenshots');
const base = process.env.PROMO_BASE ?? 'http://localhost:8090';
const scale = Number(process.env.PROMO_SCALE ?? 3);
const NOW = '2026-11-20T21:41:00+01:00';

fs.mkdirSync(outDir, { recursive: true });

let now = new Date(NOW);
const backend = createBackend({ users, now: () => now });
const browser = await launch();
const meta = { viewport: VIEWPORT, insets: INSETS, scale, shots: {}, taps: {}, boxes: {} };

/** Statusleiste (9:41, voller Empfang, voller Akku) und Home-Balken wie auf dem iPhone. */
function statusBar() {
  if (document.getElementById('promo-status')) return;
  const bar = document.createElement('div');
  bar.id = 'promo-status';
  bar.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;color:#fff;font-family:Inter_600SemiBold,-apple-system,sans-serif';
  bar.innerHTML = `
    <div style="position:absolute;left:0;top:0;width:154px;height:59px;display:flex;align-items:center;justify-content:center;padding-top:6px;box-sizing:border-box;font-size:17px;letter-spacing:-0.2px">9:41</div>
    <div style="position:absolute;right:0;top:0;width:154px;height:59px;display:flex;align-items:center;justify-content:center;gap:7px;padding-top:6px;box-sizing:border-box">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width="17" height="12" viewBox="0 0 17 12" fill="#fff"><path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.1-1.2C13.900 1.700 11.300.600 8.500.600S3.100 1.700 1.100 3.600l1.100 1.200c1.700-1.600 3.900-2.500 6.300-2.500z"/><path d="M8.5 6.100c1.400 0 2.700.5 3.700 1.400l1.100-1.200c-1.300-1.200-3-1.900-4.800-1.900s-3.500.7-4.800 1.900l1.100 1.200c1-.9 2.300-1.400 3.700-1.400z"/><path d="M8.500 8.200c-.900 0-1.700.3-2.300.9l2.300 2.500 2.300-2.500c-.600-.600-1.400-.900-2.300-.900z"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.2" fill="#fff"/><path d="M25 4.500v4c.8-.3 1.500-1.100 1.500-2s-.7-1.700-1.500-2z" fill="#fff" fill-opacity=".45"/></svg>
    </div>
    <div style="position:absolute;left:50%;bottom:8px;width:139px;height:5px;margin-left:-69.500px;border-radius:3px;background:#fff;opacity:.92"></div>`;
  document.body.appendChild(bar);
}

async function phone(user, storageState) {
  const opened = await openPhone(browser, backend, user, { base, scale, storageState });
  const { page } = opened;
  page.setTime = async (value) => {
    now = new Date(value);
    await page.clock.setFixedTime(now);
  };
  await page.setTime(now);
  await page.goto(`${base}/promo.html`);
  await page.waitForFunction(
    () =>
      window.__promo?.useGameStore.getState().hydrated &&
      window.__promo.useAuthStore.getState().isAuthenticated,
    null,
    { timeout: 180000 },
  );
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  return opened;
}

async function shot(page, name) {
  await page.waitForTimeout(700);
  await page.evaluate(statusBar);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  meta.shots[name] = `${name}.png`;
  console.log('  Screenshot', name);
}

/** Merkt sich die Mitte eines Elements, damit das Video dort einen Tipp-Punkt zeigt. */
async function tap(page, name, locator, { click = true } = {}) {
  const box = await locator.boundingBox();
  meta.taps[name] = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  if (click) await locator.click();
}

/** Merkt sich die Lage eines Elements, damit das Video es hervorheben kann. */
async function mark(page, name, locator) {
  const box = await locator.filter({ visible: true }).first().boundingBox();
  if (!box) throw new Error(`Element für „${name}“ nicht sichtbar.`);
  meta.boxes[name] = Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)]));
}

const text = (page, value) => page.getByText(value, { exact: true });
const tab = (page, name) => text(page, name).last().click();
const scrollTo = (page, top) =>
  page.evaluate((y) => {
    const candidates = [...document.querySelectorAll('div')].filter(
      (el) => el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY !== 'visible' && el.getBoundingClientRect().width > 300,
    );
    const visible = candidates.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 300 && document.elementFromPoint(215, r.top + r.height / 2) && el.contains(document.elementFromPoint(215, r.top + r.height / 2));
    });
    const target = visible.at(-1);
    if (!target) throw new Error('Kein Scrollbereich gefunden');
    target.scrollTop = y;
  }, top);

console.log('1/4 Demo-Daten einspielen …');
const sepp = await phone(users[0]);
await seedDemo(sepp.page, sepp.page.setTime);
await sepp.page.setTime(NOW);
await sepp.page.waitForTimeout(6500);

console.log('2/4 Sepps Handy: Übersicht und Statistik …');
{
  const { page } = sepp;
  await shot(page, '01-dashboard');
  await tab(page, 'Statistik');
  await shot(page, '10-statistik-gesamt');
  await text(page, 'Spieler').last().click();
  await shot(page, '11-statistik-sepp');
  await mark(page, 'bilanz', page.getByText('Spielbilanz'));
  for (const name of ['Vroni', 'Hias', 'Resi']) {
    await page.getByText(new RegExp(`^${name} · `)).click();
    await shot(page, `11-statistik-${name.toLowerCase()}`);
  }
  await page.getByText(/^Meine Gesamtstatistik/).click();
  await text(page, 'Nach Spielposition').click();
  await scrollTo(page, 470);
  await shot(page, '12-statistik-position');
  await text(page, 'Nach Spielposition').click();
  await scrollTo(page, 500);
  await shot(page, '13-statistik-spielarten');
  await text(page, 'Rufspiel +').click();
  await shot(page, '14-statistik-rollen');
  await text(page, 'Rufspiel −').click().catch(() => undefined);
  await scrollTo(page, 0);
  await tab(page, 'Tische');
  await shot(page, '02-tische');
  await tap(page, 'tischOeffnen', page.getByText(/läuft$/).first());
  await shot(page, '03-tisch');
}

console.log('3/4 Vronis Handy: derselbe Tisch vor der Eingabe …');
const vroni = await phone(users[1]);
{
  const { page } = vroni;
  await page.waitForFunction(() => window.__promo.useSharedTableStatus.getState().tables.length > 0, null, { timeout: 30000 });
  await tab(page, 'Tische');
  await page.getByText(/Gemeinsamer Tisch · läuft/).click();
  await text(page, 'Verlauf').last().waitFor();
  await shot(page, 'v1-tisch-vorher');
  await text(page, 'Verlauf').last().click();
  await shot(page, 'v2-verlauf-vorher');
}

console.log('4/4 Sepp trägt ein Herzsolo ein …');
{
  const { page } = sepp;
  await tap(page, 'ansager', text(page, 'Sepp').last());
  await shot(page, '04-spielauswahl');
  await tap(page, 'solo', text(page, 'Solo').last());
  await shot(page, '05-solo');
  await scrollTo(page, 230);
  await tap(page, 'herz', text(page, 'Herz').last());
  await shot(page, '06-herzsolo');
  await tap(page, 'laufende', page.getByRole('button', { name: /Laufende.*(erhöhen|mehr|\+)/i }));
  await shot(page, '07-laufende');
  await tap(page, 'schneider', page.getByRole('switch', { name: /Schneider/ }));
  await shot(page, '08-schneider');
  await mark(page, 'betrag', page.getByText(/^\+2,70/));
  await text(page, 'Preisaufschlüsselung +').click();
  await scrollTo(page, 100000);
  await shot(page, '09-preisaufschluesselung');
  await tap(page, 'speichern', page.getByText('Runde speichern'));
  await text(page, 'Spiel eingetragen').waitFor();
  await shot(page, '09-tisch-nachher');
  await mark(page, 'saldoSepp', page.getByText(/^\+3,30/));
  await page.waitForTimeout(6000);
  await text(page, 'Verlauf').last().click();
  await shot(page, '09-verlauf-nachher');
}
{
  const { page } = vroni;
  await page.waitForFunction(() => window.__promo.useGameStore.getState().rounds.length === 12, null, { timeout: 30000 });
  await shot(page, 'v3-verlauf-nachher');
  await mark(page, 'neueZeile', page.getByText('Herzsolo'));
  await text(page, 'Spieler').last().click();
  await shot(page, 'v4-tisch-nachher');
  await mark(page, 'saldoVroni', page.getByText(/^\+1,90/));
}

const problems = [...sepp.errors, ...vroni.errors, ...backend.unhandled];
fs.writeFileSync(path.join(outDir, 'shots.json'), JSON.stringify(meta, null, 2));
await browser.close();
console.log(`Fertig: ${Object.keys(meta.shots).length} Screenshots in ${outDir}`);
console.log(`Blockierte Fremdanfragen: ${backend.blocked.length}`, backend.blocked);
if (problems.length) {
  console.error('Probleme während der Aufnahme:', problems);
  process.exitCode = 1;
}
