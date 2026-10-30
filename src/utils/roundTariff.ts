import { getGameRules } from '../constants/tableSettings';
import type {
  GameType,
  RoundTariffOptions,
  TableGameTypeId,
  TableSettings,
} from '../types/game';
import { toSafeCents } from './accounting';
import { cardSuits, supportsCardSuit } from './cardSuits';

export const emptyTariffOptions: RoundTariffOptions = {
  laufende: 0,
  schneider: false,
  schwarz: false,
  stoss: 0,
  legerCount: 0,
  turboRamsch: false,
};
export function calculateRoundTariff(
  settings: TableSettings,
  gameType: GameType,
  options: RoundTariffOptions,
) {
  const id = gameType === 'sauspiel' ? 'rufspiel' : gameType;
  const base = settings.games[id as TableGameTypeId];
  if (!base?.enabled)
    throw new Error('Diese Spielart ist am Tisch nicht aktiviert.');
  for (const [count, maximum] of [
    [options.laufende, 14],
    [options.stoss, 4],
    [options.legerCount, 4],
  ]) {
    if (!Number.isInteger(count) || count < 0 || count > maximum)
      throw new Error('Ungültige Anzahl für eine Bonusregel.');
  }
  if (
    ![options.schneider, options.schwarz, options.turboRamsch].every(
      (value) => typeof value === 'boolean',
    )
  )
    throw new Error('Ungültige Bonusauswahl.');
  const rules = settings.bonusRules;
  const gameRules = getGameRules(settings, gameType);
  for (const key of [
    'laufende',
    'schneider',
    'schwarz',
    'stoss',
    'leger',
  ] as const) {
    const used = key === 'leger' ? options.legerCount : options[key];
    if (used && !gameRules.bonuses[key])
      throw new Error('Diese Bonusregel ist für die Spielart nicht erlaubt.');
  }
  if (
    options.laufende &&
    (options.laufende < gameRules.laufendeMin ||
      options.laufende > gameRules.laufendeMax)
  )
    throw new Error(
      `Laufende müssen zwischen ${gameRules.laufendeMin} und ${gameRules.laufendeMax} liegen.`,
    );
  const jungfrauen = options.jungfrauen ?? 0;
  const durchmarsch = options.durchmarsch ?? false;
  if (
    !Number.isInteger(jungfrauen) ||
    jungfrauen < 0 ||
    jungfrauen > 2 ||
    typeof durchmarsch !== 'boolean' ||
    ((jungfrauen > 0 || durchmarsch) && gameType !== 'ramsch') ||
    (jungfrauen > 0 && (!gameRules.ramschJungfrau || durchmarsch)) ||
    (durchmarsch && !gameRules.ramschDurchmarsch)
  )
    throw new Error('Ungültige Ramsch-Auswahl.');
  if (
    (options.laufende && !rules.laufende.enabled) ||
    (options.schneider && !rules.schneider.enabled) ||
    (options.schwarz && !rules.schwarz.enabled) ||
    (options.stoss && !rules.stoss.enabled) ||
    (options.legerCount && !rules.leger.enabled)
  )
    throw new Error(
      'Eine ausgewählte Bonusregel ist am Tisch nicht aktiviert.',
    );
  const price = (value: number) => {
    const cents = toSafeCents(value);
    if (cents === null || cents < 0)
      throw new Error('Der Tarif muss in ganzen Cent angegeben sein.');
    return cents;
  };
  const lines: { label: string; cents: number }[] = [
    { label: 'Grundtarif', cents: price(base.value) },
  ];
  if (options.laufende)
    lines.push({
      label: `${options.laufende} Laufende`,
      cents: price(rules.laufende.value) * options.laufende,
    });
  // Schwarz includes Schneider when Schneider is an enabled table rule.
  if (
    options.schneider ||
    (options.schwarz && rules.schneider.enabled && gameRules.bonuses.schneider)
  )
    lines.push({ label: 'Schneider', cents: price(rules.schneider.value) });
  if (options.schwarz)
    lines.push({ label: 'Schwarz', cents: price(rules.schwarz.value) });
  const subtotalCents = lines.reduce((sum, line) => sum + line.cents, 0);
  const factor = (value: number, count: number) => {
    if (!count) return 1;
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error('Ungültiger Verdopplungsfaktor.');
    return value ** count;
  };
  const legerFactor = factor(rules.leger.value, options.legerCount);
  const stossFactor = factor(rules.stoss.value, options.stoss);
  const turboFactor = options.turboRamsch ? 2 : 1;
  const jungfrauFactor = 2 ** jungfrauen;
  const multiplier = legerFactor * stossFactor * turboFactor * jungfrauFactor;
  const totalCents = subtotalCents * multiplier;
  if (
    !Number.isSafeInteger(totalCents) ||
    totalCents <= 0 ||
    toSafeCents(totalCents / 100) !== totalCents
  )
    throw new Error('Der Spielwert ist ungültig oder zu groß.');
  return {
    lines,
    subtotalCents,
    legerFactor,
    stossFactor,
    turboFactor,
    jungfrauFactor,
    multiplier,
    totalCents,
  };
}

export function calculatePartyAmount(
  unitCents: number,
  gameType: GameType,
  winners: number,
  losers: number,
  options?: Pick<RoundTariffOptions, 'durchmarsch'>,
) {
  if (gameType === 'stock')
    throw new Error('Stock bitte als manuellen Gesamtgewinn erfassen.');
  if (
    gameType === 'ramsch' &&
    options &&
    (options.durchmarsch
      ? winners !== 1 || losers !== 3
      : winners !== 3 || losers !== 1)
  )
    throw new Error(
      options.durchmarsch
        ? 'Beim Durchmarsch bitte einen Gewinner und drei Verlierer wählen.'
        : 'Beim Ramsch bitte den Spieler mit den höchsten Augen als Verlierer wählen.',
    );
  const partnerGame = [
    'rufspiel',
    'sauspiel',
    'hochzeit',
    'kreuzbock',
  ].includes(gameType);
  if (
    partnerGame
      ? winners !== 2 || losers !== 2
      : !((winners === 1 && losers === 3) || (winners === 3 && losers === 1))
  )
    throw new Error(
      partnerGame
        ? 'Bitte zwei Gewinner und zwei Verlierer wählen.'
        : 'Bitte eine Partei mit einem und eine Partei mit drei Spielern wählen.',
    );
  const totalCents = unitCents * Math.max(winners, losers);
  if (
    !Number.isSafeInteger(totalCents) ||
    toSafeCents(totalCents / 100) !== totalCents
  )
    throw new Error('Der Gesamtbetrag ist zu groß.');
  return {
    totalCents,
    winnerCents: totalCents / winners,
    loserCents: totalCents / losers,
  };
}

export function isValidRoundMetadata(
  round: import('../types/game').GameRound,
): boolean {
  try {
    if (
      round.suit !== undefined &&
      (!cardSuits.some(({ id }) => id === round.suit) ||
        !supportsCardSuit(round.gameType))
    )
      return false;
    if (
      round.stockCompletesDeal !== undefined &&
      (typeof round.stockCompletesDeal !== 'boolean' ||
        round.stockAction !== 'deposit')
    )
      return false;
    if (
      round.stockAction &&
      !['deposit', 'payout'].includes(round.stockAction)
    ) {
      const cents = toSafeCents(round.amount);
      if (
        !['carryIn', 'carryOut', 'refund'].includes(round.stockAction) ||
        round.gameType !== 'stock' ||
        round.tariffOptions !== undefined ||
        cents === null ||
        cents <= 0 ||
        cents % 4 !== 0
      )
        return false;
    }
    if (round.stockAction === 'deposit') {
      const base = round.settingsSnapshot.games.stock;
      const cents = toSafeCents(base.value);
      if (
        !base.enabled ||
        cents === null ||
        cents <= 0 ||
        round.gameType !== 'stock' ||
        round.tariffOptions !== undefined ||
        toSafeCents(round.amount) !== cents * 4
      )
        return false;
    }
    if (round.roundContext !== undefined) {
      const context = round.roundContext;
      if (
        !context ||
        (context.completesDeal !== undefined &&
          typeof context.completesDeal !== 'boolean') ||
        typeof context.dealerIdBefore !== 'string' ||
        !context.dealerIdBefore.trim() ||
        typeof context.turboRamsch !== 'boolean' ||
        !Array.isArray(context.legerPlayerIds) ||
        new Set(context.legerPlayerIds).size !==
          context.legerPlayerIds.length ||
        !context.legerPlayerIds.every(
          (id) => typeof id === 'string' && id.trim(),
        )
      )
        return false;
    }
    if (round.tariffOptions !== undefined) {
      const tariff = calculateRoundTariff(
        round.settingsSnapshot,
        round.gameType,
        round.tariffOptions,
      );
      const count = round.winnerIds?.length ?? 1;
      if (
        calculatePartyAmount(
          tariff.totalCents,
          round.gameType,
          count,
          round.loserIds.length,
          round.settingsSnapshot.gameRules ||
            round.tariffOptions.durchmarsch !== undefined ||
            round.tariffOptions.jungfrauen !== undefined
            ? round.tariffOptions
            : undefined,
        ).totalCents !== toSafeCents(round.amount)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
