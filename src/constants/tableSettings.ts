import type {
  BonusRuleId,
  GameRuleOptions,
  GameType,
  TableGameTypeId,
  TableSettingEntry,
  TableSettings,
} from '../types/game';

export type TableSettingDefinition<TId extends string> = {
  defaultEnabled: boolean;
  defaultValue: number;
  description: string;
  id: TId;
  label: string;
  mode: 'price' | 'multiplier';
  section: 'base' | 'bonus' | 'variant';
};

export const gameRuleDefinitions: TableSettingDefinition<TableGameTypeId>[] = [
  {
    defaultEnabled: true,
    defaultValue: 0.2,
    description: 'Das normale Rufspiel mit Partner über die gerufene Sau.',
    id: 'rufspiel',
    label: 'Rufspiel',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: true,
    defaultValue: 0.5,
    description: 'Ein Alleinspiel gegen die drei Mitspieler.',
    id: 'solo',
    label: 'Solo',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.5,
    description: 'Beim Wenz sind nur Unter Trumpf.',
    id: 'wenz',
    label: 'Wenz',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.5,
    description: 'Ein Wenz mit zusätzlicher Trumpffarbe.',
    id: 'farbwenz',
    label: 'FarbWenz',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.5,
    description: 'Beim Geier sind nur Ober Trumpf.',
    id: 'geier',
    label: 'Geier',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.5,
    description: 'Ein Geier mit zusätzlicher Trumpffarbe.',
    id: 'farbgeier',
    label: 'Farbgeier',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.2,
    description: 'Wenn niemand spielt, wird Ramsch nach Hausregeln gespielt.',
    id: 'ramsch',
    label: 'Ramsch',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.5,
    description:
      'Bettel ist ein Nullspiel: Der Spieler darf keinen Stich machen.',
    id: 'bettel',
    label: 'Bettel',
    mode: 'price',
    section: 'variant',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.5,
    description: 'Hochzeit verbindet Sonderkarten zu einer Partnerschaft.',
    id: 'hochzeit',
    label: 'Hochzeit',
    mode: 'price',
    section: 'variant',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.5,
    description:
      'Kreuzbock ist eine Sonderrunde mit gekreuzten Partnerschaften.',
    id: 'kreuzbock',
    label: 'Kreuzbock',
    mode: 'price',
    section: 'variant',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.5,
    description:
      'Einsatz je Spieler: Alle vier zahlen ein. Die beiden Sauspiel-Gewinner erhalten bei Auszahlung je die Hälfte des Stocks.',
    id: 'stock',
    label: 'Stock',
    mode: 'price',
    section: 'variant',
  },
];

export const bonusRuleDefinitions: TableSettingDefinition<BonusRuleId>[] = [
  {
    defaultEnabled: true,
    defaultValue: 0.1,
    description:
      'Laufende erhöhen den Spielwert je zusammenhängender Trumpfreihe.',
    id: 'laufende',
    label: 'Laufende',
    mode: 'price',
    section: 'bonus',
  },
  {
    defaultEnabled: true,
    defaultValue: 0.1,
    description:
      'Schneider gilt, wenn eine Partei unter der vereinbarten Punktgrenze bleibt.',
    id: 'schneider',
    label: 'Schneider',
    mode: 'price',
    section: 'bonus',
  },
  {
    defaultEnabled: true,
    defaultValue: 0.1,
    description: 'Schwarz gilt, wenn eine Partei keinen Stich macht.',
    id: 'schwarz',
    label: 'Schwarz',
    mode: 'price',
    section: 'bonus',
  },
  {
    defaultEnabled: true,
    defaultValue: 2,
    description: 'Stoß verdoppelt den aktuellen Spielwert.',
    id: 'stoss',
    label: 'Stoß',
    mode: 'multiplier',
    section: 'bonus',
  },
  {
    defaultEnabled: true,
    defaultValue: 2,
    description: 'Jeder Leger verdoppelt den Spielwert der aktuellen Runde.',
    id: 'leger',
    label: 'Leger',
    mode: 'multiplier',
    section: 'bonus',
  },
];

function createEntries<TId extends string>(
  definitions: TableSettingDefinition<TId>[],
) {
  return definitions.reduce(
    (entries, definition) => ({
      ...entries,
      [definition.id]: {
        enabled: definition.defaultEnabled,
        mode: definition.mode,
        value: definition.defaultValue,
      },
    }),
    {} as Record<TId, TableSettingEntry>,
  );
}

export function createDefaultTableSettings(): TableSettings {
  return {
    gameRules: Object.fromEntries(
      gameRuleDefinitions.map(({ id }) => [id, defaultGameRules(id)]),
    ),
    bonusRules: createEntries(bonusRuleDefinitions),
    games: createEntries(gameRuleDefinitions),
  };
}

export function defaultGameRules(id: GameType): GameRuleOptions {
  const noTrumpBonus = ['ramsch', 'bettel', 'stock'].includes(id);
  return {
    bonuses: {
      laufende: !noTrumpBonus,
      schneider: !noTrumpBonus,
      schwarz: !noTrumpBonus,
      stoss: id !== 'stock',
      leger: id !== 'stock',
    },
    laufendeMin: ['wenz', 'geier'].includes(id) ? 2 : 3,
    laufendeMax: ['wenz', 'geier'].includes(id)
      ? 4
      : ['rufspiel', 'sauspiel', 'hochzeit', 'kreuzbock'].includes(id)
        ? 14
        : 8,
    ramschJungfrau: true,
    ramschDurchmarsch: true,
  };
}

/** Old snapshots retain their original, unrestricted bonus calculation. */
export function getGameRules(
  settings: TableSettings,
  type: GameType,
): GameRuleOptions {
  const id = (type === 'sauspiel' ? 'rufspiel' : type) as TableGameTypeId;
  return (
    settings.gameRules?.[id] ?? {
      bonuses: {
        laufende: true,
        schneider: true,
        schwarz: true,
        stoss: true,
        leger: true,
      },
      laufendeMin: 1,
      laufendeMax: 8,
      ramschJungfrau: true,
      ramschDurchmarsch: true,
    }
  );
}

function normalizeEntry(
  entry: Partial<TableSettingEntry> | undefined,
  definition: TableSettingDefinition<string>,
): TableSettingEntry {
  const numericValue = Number(entry?.value);

  return {
    enabled:
      typeof entry?.enabled === 'boolean'
        ? entry.enabled
        : definition.defaultEnabled,
    mode: definition.mode,
    value: Number.isFinite(numericValue)
      ? numericValue
      : definition.defaultValue,
  };
}

export function normalizeTableSettings(
  settings?: Partial<TableSettings> | null,
) {
  return {
    ...(!settings || settings.gameRules
      ? {
          gameRules: Object.fromEntries(
            gameRuleDefinitions
              .filter(
                ({ id }) => !settings || settings.gameRules?.[id] !== undefined,
              )
              .map(({ id }) => {
                const original = settings?.gameRules?.[id];
                const fallback = defaultGameRules(id);
                const inputMin = original?.laufendeMin;
                const min =
                  Number.isInteger(inputMin) &&
                  inputMin! >= 1 &&
                  inputMin! <= 14
                    ? inputMin!
                    : fallback.laufendeMin;
                const max = original?.laufendeMax;
                return [
                  id,
                  {
                    bonuses: Object.fromEntries(
                      bonusRuleDefinitions.map(({ id: bonus }) => [
                        bonus,
                        typeof original?.bonuses?.[bonus] === 'boolean'
                          ? original.bonuses[bonus]
                          : fallback.bonuses[bonus],
                      ]),
                    ),
                    laufendeMin: min,
                    laufendeMax:
                      Number.isInteger(max) &&
                      max! >= (min ?? fallback.laufendeMin) &&
                      max! <= 14
                        ? max
                        : Math.max(
                            min ?? fallback.laufendeMin,
                            fallback.laufendeMax,
                          ),
                    ramschJungfrau:
                      original?.ramschJungfrau ?? fallback.ramschJungfrau,
                    ramschDurchmarsch:
                      original?.ramschDurchmarsch ?? fallback.ramschDurchmarsch,
                  },
                ];
              }),
          ) as TableSettings['gameRules'],
        }
      : {}),
    bonusRules: bonusRuleDefinitions.reduce(
      (entries, definition) => ({
        ...entries,
        [definition.id]: normalizeEntry(
          settings?.bonusRules?.[definition.id],
          definition,
        ),
      }),
      {} as TableSettings['bonusRules'],
    ),
    games: gameRuleDefinitions.reduce(
      (entries, definition) => ({
        ...entries,
        [definition.id]: normalizeEntry(
          settings?.games?.[definition.id],
          definition,
        ),
      }),
      {} as TableSettings['games'],
    ),
  };
}

export function cloneTableSettings(settings: TableSettings) {
  return normalizeTableSettings(settings);
}
