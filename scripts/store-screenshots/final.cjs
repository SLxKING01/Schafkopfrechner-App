const { open } = require('./lib.cjs');
const { enter } = require('./round.cjs');
const { rounds } = require('./evening.cjs');
const out =
  require('path').join(process.cwd(), 'scripts/store-screenshots/.raw') + '/';
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const { b, p } = await open({ clock: true, scale: 3 });
  const shot = async (name) => {
    await p.waitForTimeout(900);
    await p.screenshot({ path: out + name + '.png' });
    console.log('shot', name);
  };
  await p.getByText('Ohne Account spielen').click();
  await p.getByText('Tische', { exact: true }).last().click();
  await p.getByLabel('Neuen Tisch erstellen').click();
  await p.getByPlaceholder('z. B. Freitag Stammtisch').fill('Freitagsrunde');
  await p.getByLabel('Gast entfernen').nth(1).click();
  for (const n of ['Simon', 'Sepp', 'Vroni', 'Korbinian']) {
    await p.getByPlaceholder('Spielername').fill(n);
    await p.getByLabel('Spielplatz am Tisch hinzufügen').click();
  }
  await p
    .getByText('Regeln & Tarife', { exact: true })
    .first()
    .scrollIntoViewIfNeeded();
  await p.mouse.wheel(0, 180);
  await shot('6-regeln');
  await p.getByLabel('Tisch erstellen', { exact: true }).click();
  await p.waitForTimeout(800);
  for (const [i, r] of rounds.entries())
    await enter(p, {
      tick: '07:00',
      ...r,
      shot: i === rounds.length - 1 ? () => shot('2-eingabe') : undefined,
    });
  await p.clock.fastForward('00:10');
  const toastX = p
    .locator('text=Spiel eingetragen')
    .locator('xpath=../..')
    .getByRole('button')
    .last();
  if (await toastX.count()) await toastX.click().catch(() => {});
  await shot('1-tisch');
  await p.getByLabel('Verlauf Tab').click();
  await shot('3-verlauf');
  await p.getByLabel('Spieler Tab').click();
  await p.getByText('Spieltag abschließen', { exact: true }).click();
  await shot('4-abrechnung');
  await p.goto('http://localhost:8099/?preview=off');
  await p.waitForTimeout(1500);
  const guest = p.getByText('Ohne Account spielen');
  if (await guest.count()) await guest.click();
  await p.getByText('Statistik', { exact: true }).last().click();
  await shot('5-statistik');
  await p.getByText('Spieler', { exact: true }).first().click();
  await shot('5b-statistik-spieler');
  await b.close();
})();
