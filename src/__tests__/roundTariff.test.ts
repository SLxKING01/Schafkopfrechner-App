import { createDefaultTableSettings } from '../constants/tableSettings';
import { calculateRoundBalances } from '../utils/accounting';
import {
  calculatePartyAmount,
  calculateRoundTariff,
  emptyTariffOptions,
} from '../utils/roundTariff';

const roster = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
it.each([0, 1, 2, 3, 4])(
  'doubles the entire tariff for each Kontra/Re level %i',
  (stoss) => {
    const settings = createDefaultTableSettings();
    const result = calculateRoundTariff(settings, 'rufspiel', {
      ...emptyTariffOptions,
      laufende: 3,
      schneider: true,
      stoss,
    });
    expect(result.subtotalCents).toBe(60);
    expect(result.stossFactor).toBe(2 ** stoss);
    expect(result.totalCents).toBe(60 * 2 ** stoss);
  },
);
it.each([
  ['rufspiel', 20],
  ['ramsch', 20],
  ['solo', 50],
  ['wenz', 50],
  ['farbwenz', 50],
  ['geier', 50],
  ['farbgeier', 50],
  ['bettel', 50],
  ['hochzeit', 50],
  ['kreuzbock', 50],
] as const)('uses the table base tariff for %s', (type, cents) => {
  const settings = createDefaultTableSettings();
  settings.games[type].enabled = true;
  expect(
    calculateRoundTariff(settings, type, emptyTariffOptions).totalCents,
  ).toBe(cents);
});
it('adds Laufende, Schneider and Schwarz before Stoß, Leger and Turbo multipliers', () => {
  const settings = createDefaultTableSettings();
  settings.bonusRules.stoss.enabled = true;
  const options = {
    ...emptyTariffOptions,
    laufende: 3,
    schwarz: true,
    stoss: 1,
    legerCount: 2,
    turboRamsch: true,
  };
  const result = calculateRoundTariff(settings, 'rufspiel', options);
  expect(result.subtotalCents).toBe(70);
  expect(result.multiplier).toBe(16);
  expect(result.totalCents).toBe(1120);
  expect(
    calculateRoundTariff(settings, 'rufspiel', { ...options, schneider: true })
      .totalCents,
  ).toBe(1120);
});
it.each([
  ['rufspiel', ['a', 'b'], ['c', 'd'], 20, [20, 20, -20, -20]],
  ['solo', ['a'], ['b', 'c', 'd'], 50, [150, -50, -50, -50]],
  ['solo', ['b', 'c', 'd'], ['a'], 50, [-150, 50, 50, 50]],
] as const)(
  'distributes %s to both actual parties',
  (type, winners, losers, unit, expected) => {
    const party = calculatePartyAmount(
      unit,
      type,
      winners.length,
      losers.length,
    );
    const balances = calculateRoundBalances(roster, [
      {
        winnerId: winners[0],
        winnerIds: [...winners],
        loserIds: [...losers],
        amount: party.totalCents / 100,
      },
    ]);
    expect(balances.map((balance) => Math.round(balance.amount * 100))).toEqual(
      expected,
    );
  },
);
it('uses custom table tariffs and rejects disabled bonuses and incomplete parties', () => {
  const settings = createDefaultTableSettings();
  settings.bonusRules.stoss.enabled = false;
  settings.games.rufspiel.value = 0.3;
  expect(
    calculateRoundTariff(settings, 'rufspiel', emptyTariffOptions).totalCents,
  ).toBe(30);
  expect(() =>
    calculateRoundTariff(settings, 'rufspiel', {
      ...emptyTariffOptions,
      stoss: 1,
    }),
  ).toThrow();
  expect(() => calculatePartyAmount(20, 'rufspiel', 1, 3)).toThrow();
  expect(() => calculatePartyAmount(50, 'solo', 2, 2)).toThrow();
  expect(() =>
    calculateRoundTariff(settings, 'rufspiel', {
      ...emptyTariffOptions,
      laufende: 1.1,
    }),
  ).toThrow();
});
it('rejects duplicate winners, overlapping parties and missing winner representatives', () => {
  for (const winners of [
    ['a', 'a'],
    ['a', 'c'],
    ['b', 'd'],
  ]) {
    expect(() =>
      calculateRoundBalances(roster, [
        {
          winnerId: 'a',
          winnerIds: winners,
          loserIds: ['c', 'd'],
          amount: 0.4,
        },
      ]),
    ).toThrow();
  }
});
