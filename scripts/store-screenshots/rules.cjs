const { open } = require('./lib.cjs');
(async () => {
  const { b, p } = await open({ scale: 3 });
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
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.mouse.wheel(0, -40);
  await p.waitForTimeout(900);
  await p.screenshot({
    path:
      require('path').join(process.cwd(), 'scripts/store-screenshots/.raw') +
      '/6-regeln.png',
  });
  await b.close();
})();
