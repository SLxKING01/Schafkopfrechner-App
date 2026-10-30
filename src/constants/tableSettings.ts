import type {
  BonusRuleId,
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
    defaultValue: 0.1,
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
    defaultValue: 0.2,
    description: 'Beim Wenz sind nur Unter Trumpf.',
    id: 'wenz',
    label: 'Wenz',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.3,
    description: 'Ein Wenz mit zusätzlicher Trumpffarbe.',
    id: 'farbwenz',
    label: 'FarbWenz',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.2,
    description: 'Beim Geier sind nur Ober Trumpf.',
    id: 'geier',
    label: 'Geier',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.3,
    description: 'Ein Geier mit zusätzlicher Trumpffarbe.',
    id: 'farbgeier',
    label: 'Farbgeier',
    mode: 'price',
    section: 'base',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.1,
    description: 'Wenn niemand spielt, wird Ramsch nach Hausregeln gespielt.',
    id: 'ramsch',
    label: 'Ramsch',
    mode: 'price',
    section: 'variant',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.2,
    description:
      'Bettel ist ein Nullspiel: Der Spieler darf keinen Stich machen.',
    id: 'bettel',
    label: 'Bettel',
    mode: 'price',
    section: 'variant',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.2,
    description: 'Hochzeit verbindet Sonderkarten zu einer Partnerschaft.',
    id: 'hochzeit',
    label: 'Hochzeit',
    mode: 'price',
    section: 'variant',
  },
  {
    defaultEnabled: false,
    defaultValue: 0.2,
    description:
      'Kreuzbock ist eine Sonderrunde mit gekreuzten Partnerschaften.',
    id: 'kreuzbock',
    label: 'Kreuzbock',
    mode: 'price',
    section: 'variant',
  },
  {
    defaultEnabled: false,
    defaultValue: 0,
    description: 'Stock sammelt Einsätze für eine spätere Auszahlung.',
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
    defaultEnabled: false,
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
    bonusRules: createEntries(bonusRuleDefinitions),
    games: createEntries(gameRuleDefinitions),
  };
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
