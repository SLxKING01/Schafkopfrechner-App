exports.enter = async (
  p,
  {
    tick,
    declarer,
    game,
    partner,
    won = true,
    suit,
    laufende = 0,
    schneider = false,
    ramschLoser,
    shot,
  },
) => {
  if (tick) await p.clock.fastForward(tick);
  await p
    .getByRole('button', { name: new RegExp('^' + declarer + ', ') })
    .click();
  await p.getByText(game, { exact: true }).first().click();
  await p.waitForTimeout(300);
  if (ramschLoser)
    await p.getByLabel(ramschLoser + ' verloren', { exact: true }).click();
  else if (partner) {
    if (!won)
      await p.getByLabel(declarer + ' verloren', { exact: true }).click();
    await p
      .getByLabel(partner + (won ? ' gewonnen' : ' verloren'), { exact: true })
      .click();
  } else if (!won)
    await p.getByLabel('Alleinspieler verloren', { exact: true }).click();
  if (suit) await p.getByLabel('Kartenfarbe ' + suit).click();
  for (let i = 0; i < laufende; i++)
    await p.getByLabel('Laufende erhöhen').click();
  if (schneider)
    await p
      .getByRole('switch', { name: 'Schneider' })
      .click()
      .catch(() => p.getByText('Schneider', { exact: true }).click());
  await p.waitForTimeout(300);
  if (shot) await shot();
  await p.getByRole('button', { name: 'Runde speichern' }).click();
  await p.waitForTimeout(1500);
  for (const label of ['Rundeneingabe schließen', 'Schließen']) {
    const c = p.getByLabel(label, { exact: true });
    if (await c.count()) {
      await c
        .first()
        .click()
        .catch(() => {});
      break;
    }
  }
  await p.waitForTimeout(500);
};
