import {
  createDefaultTableSettings,
  getGameRules,
  normalizeTableSettings,
} from '../constants/tableSettings';
import { isValidRound } from '../utils/accounting';
import {
  calculatePartyAmount,
  calculateRoundTariff,
  emptyTariffOptions,
  isValidRoundMetadata,
} from '../utils/roundTariff';

it('uses game-specific bonus permissions and Laufende bounds', () => {
  const settings = createDefaultTableSettings();
  expect(() =>
    calculateRoundTariff(settings, 'rufspiel', {
      ...emptyTariffOptions,
      laufende: 2,
    }),
  ).toThrow('zwischen 3 und 14');
  expect(
    calculateRoundTariff(settings, 'rufspiel', {
      ...emptyTariffOptions,
      laufende: 3,
    }).totalCents,
  ).toBe(50);
  settings.games.wenz.enabled = true;
  expect(
    calculateRoundTariff(settings, 'rufspiel', {
      ...emptyTariffOptions,
      laufende: 14,
    }).totalCents,
  ).toBe(160);
  settings.games.farbwenz.enabled = true;
  expect(() =>
    calculateRoundTariff(settings, 'farbwenz', {
      ...emptyTariffOptions,
      laufende: 2,
    }),
  ).toThrow();
  expect(
    calculateRoundTariff(settings, 'wenz', {
      ...emptyTariffOptions,
      laufende: 2,
    }).totalCents,
  ).toBe(70);
  expect(() =>
    calculateRoundTariff(settings, 'wenz', {
      ...emptyTariffOptions,
      laufende: 5,
    }),
  ).toThrow();
  settings.gameRules!.rufspiel!.bonuses.schneider = false;
  expect(
    calculateRoundTariff(settings, 'rufspiel', {
      ...emptyTariffOptions,
      schwarz: true,
    }).totalCents,
  ).toBe(30);
});

it('enforces explicit Ramsch outcomes even on tables created before house rules existed', () => {
  const settings = createDefaultTableSettings();
  delete settings.gameRules;
  settings.games.ramsch.enabled = true;
  const round = {
    id: 'r',
    tableId: 't',
    createdAt: new Date().toISOString(),
    gameType: 'ramsch' as const,
    settingsSnapshot: settings,
    winnerId: 'a',
    winnerIds: ['a'],
    loserIds: ['b', 'c', 'd'],
    amount: 0.6,
    tariffOptions: { ...emptyTariffOptions },
  };
  expect(isValidRoundMetadata(round)).toBe(true);
  expect(
    isValidRoundMetadata({
      ...round,
      tariffOptions: {
        ...emptyTariffOptions,
        durchmarsch: false,
        jungfrauen: 0,
      },
    }),
  ).toBe(false);
  expect(
    isValidRoundMetadata({
      ...round,
      tariffOptions: { ...emptyTariffOptions, durchmarsch: true },
    }),
  ).toBe(true);
});

it('treats Bettel as a fixed solo tariff unless house rules explicitly allow bonuses', () => {
  const settings = createDefaultTableSettings();
  settings.games.bettel.enabled = true;
  expect(
    calculateRoundTariff(settings, 'bettel', emptyTariffOptions).totalCents,
  ).toBe(50);
  expect(() =>
    calculateRoundTariff(settings, 'bettel', {
      ...emptyTariffOptions,
      schneider: true,
    }),
  ).toThrow();
  settings.gameRules!.bettel!.bonuses.schneider = true;
  expect(
    calculateRoundTariff(settings, 'bettel', {
      ...emptyTariffOptions,
      schneider: true,
    }).totalCents,
  ).toBe(60);
});

it('calculates Ramsch Jungfrauen and Durchmarsch with the correct parties', () => {
  const settings = createDefaultTableSettings();
  settings.games.ramsch.enabled = true;
  const options = { ...emptyTariffOptions, jungfrauen: 2 };
  const tariff = calculateRoundTariff(settings, 'ramsch', options);
  expect(tariff.totalCents).toBe(80);
  expect(
    calculatePartyAmount(tariff.totalCents, 'ramsch', 3, 1, options),
  ).toMatchObject({ totalCents: 240, winnerCents: 80, loserCents: 240 });
  expect(() =>
    calculatePartyAmount(20, 'ramsch', 1, 3, emptyTariffOptions),
  ).toThrow();
  expect(
    calculatePartyAmount(20, 'ramsch', 1, 3, { durchmarsch: true }).totalCents,
  ).toBe(60);
  expect(() =>
    calculateRoundTariff(settings, 'ramsch', { ...options, durchmarsch: true }),
  ).toThrow();
  settings.gameRules!.ramsch!.ramschJungfrau = false;
  settings.gameRules!.ramsch!.ramschDurchmarsch = false;
  expect(() => calculateRoundTariff(settings, 'ramsch', options)).toThrow();
  expect(() =>
    calculateRoundTariff(settings, 'ramsch', {
      ...emptyTariffOptions,
      durchmarsch: true,
    }),
  ).toThrow();
});

it('preserves historical calculations without game-specific rules', () => {
  const original = createDefaultTableSettings();
  delete original.gameRules;
  const restored = normalizeTableSettings(JSON.parse(JSON.stringify(original)));
  expect(restored.gameRules).toBeUndefined();
  expect(getGameRules(restored, 'rufspiel').laufendeMin).toBe(1);
  expect(
    calculateRoundTariff(restored, 'rufspiel', {
      ...emptyTariffOptions,
      laufende: 1,
    }).totalCents,
  ).toBe(30);
});

it('does not introduce new rules into missing historical snapshot entries', () => {
  const settings = createDefaultTableSettings();
  settings.gameRules = { wenz: settings.gameRules!.wenz! };
  const restored = normalizeTableSettings(settings);
  expect(restored.gameRules?.rufspiel).toBeUndefined();
  expect(
    calculateRoundTariff(restored, 'rufspiel', {
      ...emptyTariffOptions,
      laufende: 1,
    }).totalCents,
  ).toBe(30);
});

it('validates declarer/partner parties and only pays stock to a winning declarer party', () => {
  const players = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const round = {
    winnerId: 'a',
    winnerIds: ['a', 'b'],
    loserIds: ['c', 'd'],
    amount: 0.4,
    gameType: 'rufspiel',
    declarerId: 'a',
    partnerId: 'b',
  };
  expect(isValidRound(round, players)).toBe(true);
  expect(isValidRound({ ...round, stockAction: 'payout' }, players)).toBe(true);
  expect(isValidRound({ ...round, partnerId: 'c' }, players)).toBe(false);
  expect(
    isValidRound({ ...round, declarerId: 'c', partnerId: 'd' }, players),
  ).toBe(true);
  expect(
    isValidRound(
      { ...round, declarerId: 'c', partnerId: 'd', stockAction: 'payout' },
      players,
    ),
  ).toBe(false);
});
