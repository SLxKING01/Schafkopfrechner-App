import { Info, Minus, Plus, X } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  bonusRuleDefinitions,
  gameRuleDefinitions,
  getGameRules,
  normalizeTableSettings,
  type TableSettingDefinition,
} from '../../constants/tableSettings';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import type {
  BonusRuleId,
  GameRuleOptions,
  TableGameTypeId,
  TableSettingEntry,
  TableSettings,
} from '../../types/game';
import { AppText } from '../ui/AppText';

type TableSettingsEditorProps = {
  settings: TableSettings;
  onChange: (settings: TableSettings) => void;
};

type InfoState = {
  description: string;
  label: string;
} | null;

const sections = [
  {
    definitions: gameRuleDefinitions.filter(
      (definition) => definition.section === 'base',
    ),
    key: 'base',
    title: 'Grundspiele',
    type: 'games' as const,
  },
  {
    definitions: bonusRuleDefinitions,
    key: 'bonus',
    title: 'Bonusregeln',
    type: 'bonusRules' as const,
  },
  {
    definitions: gameRuleDefinitions.filter(
      (definition) => definition.section === 'variant',
    ),
    key: 'variant',
    title: 'Weitere Spielvarianten',
    type: 'games' as const,
  },
];

function formatValue(value: number, mode: TableSettingEntry['mode']) {
  if (mode === 'multiplier') {
    return `${value.toFixed(0)}x`;
  }

  return value.toFixed(2).replace('.', ',');
}

function cloneSettings(settings: TableSettings) {
  return normalizeTableSettings(settings);
}

export const TableSettingsEditor = memo(function TableSettingsEditor({
  settings,
  onChange,
}: TableSettingsEditorProps) {
  const safeSettings = useMemo(
    () => normalizeTableSettings(settings),
    [settings],
  );
  const [info, setInfo] = useState<InfoState>(null);
  const [expandedRules, setExpandedRules] = useState<TableGameTypeId | null>(
    null,
  );
  const rules = expandedRules
    ? getGameRules(safeSettings, expandedRules)
    : null;
  const changeRules = (change: Partial<GameRuleOptions>) => {
    if (!expandedRules || !rules) return;
    onChange({
      ...safeSettings,
      gameRules: {
        ...safeSettings.gameRules,
        [expandedRules]: { ...rules, ...change },
      },
    });
  };

  const updateEntry = useCallback(
    (
      group: 'games' | 'bonusRules',
      id: TableGameTypeId | BonusRuleId,
      nextEntry: Partial<TableSettingEntry>,
    ) => {
      const nextSettings = cloneSettings(safeSettings);
      const currentEntry =
        group === 'games'
          ? nextSettings.games[id as TableGameTypeId]
          : nextSettings.bonusRules[id as BonusRuleId];

      if (group === 'games') {
        nextSettings.games[id as TableGameTypeId] = {
          ...currentEntry,
          ...nextEntry,
        };
      } else {
        nextSettings.bonusRules[id as BonusRuleId] = {
          ...currentEntry,
          ...nextEntry,
        };
      }

      onChange(nextSettings);
    },
    [onChange, safeSettings],
  );

  return (
    <>
      <View style={styles.root}>
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <AppText style={styles.sectionTitle}>{section.title}</AppText>
            <View style={styles.rows}>
              {section.definitions.map((definition) => {
                const entry =
                  section.type === 'games'
                    ? safeSettings.games[definition.id as TableGameTypeId]
                    : safeSettings.bonusRules[definition.id as BonusRuleId];

                return (
                  <SettingRow
                    key={definition.id}
                    definition={definition}
                    entry={entry}
                    onInfo={() =>
                      setInfo({
                        description: definition.description,
                        label: definition.label,
                      })
                    }
                    onToggle={(enabled) =>
                      updateEntry(section.type, definition.id, { enabled })
                    }
                    onValueChange={(value) =>
                      updateEntry(section.type, definition.id, {
                        value,
                      })
                    }
                  />
                );
              })}
            </View>
          </View>
        ))}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Hausregeln je Spielart</AppText>
          <AppText style={styles.infoDescription}>
            Globale Bonusregeln gelten nur für die hier erlaubten Spielarten.
          </AppText>
          <View style={styles.ruleContent}>
            {gameRuleDefinitions
              .filter(
                ({ id }) => id !== 'stock' && safeSettings.games[id].enabled,
              )
              .map(({ id, label }) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Hausregeln ${label}`}
                  accessibilityState={{ expanded: expandedRules === id }}
                  style={styles.houseRuleButton}
                  onPress={() =>
                    setExpandedRules(expandedRules === id ? null : id)
                  }
                >
                  <AppText>{label}</AppText>
                </Pressable>
              ))}
          </View>
          {rules && expandedRules ? (
            <View style={styles.row}>
              <AppText style={styles.sectionTitle}>
                {
                  gameRuleDefinitions.find(({ id }) => id === expandedRules)
                    ?.label
                }
              </AppText>
              {expandedRules === 'ramsch' ? (
                <AppText style={styles.infoDescription}>
                  Normaler Ramsch: Höchste Augenzahl zahlt an die anderen drei.
                  Durchmarsch: Ein Spieler gewinnt gegen alle drei. Jede
                  Jungfrau verdoppelt den Tarif.
                </AppText>
              ) : expandedRules === 'bettel' ? (
                <AppText style={styles.infoDescription}>
                  Bettel: Der Spieler gewinnt ohne Stich und verliert ab dem
                  ersten Stich. Fester Tarif gegen drei; Zuschläge sind
                  standardmäßig ausgeschaltet.
                </AppText>
              ) : null}
              {bonusRuleDefinitions.map(({ id, label }) => (
                <View key={id} style={styles.ruleHeader}>
                  <AppText style={styles.rowLabel}>{label} erlaubt</AppText>
                  <Switch
                    accessibilityLabel={`${expandedRules}: ${label} erlauben`}
                    value={rules.bonuses[id]}
                    onValueChange={(value) =>
                      changeRules({
                        bonuses: { ...rules.bonuses, [id]: value },
                      })
                    }
                  />
                </View>
              ))}
              {rules.bonuses.laufende ? (
                <>
                  <View style={styles.ruleHeader}>
                    <AppText style={styles.rowLabel}>
                      Laufende ab {rules.laufendeMin}
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mindestlaufende verringern"
                      disabled={rules.laufendeMin <= 1}
                      style={styles.stepButton}
                      onPress={() =>
                        changeRules({ laufendeMin: rules.laufendeMin - 1 })
                      }
                    >
                      <AppText>−</AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mindestlaufende erhöhen"
                      disabled={rules.laufendeMin >= rules.laufendeMax}
                      style={styles.stepButton}
                      onPress={() =>
                        changeRules({ laufendeMin: rules.laufendeMin + 1 })
                      }
                    >
                      <AppText>+</AppText>
                    </Pressable>
                  </View>
                  <View style={styles.ruleHeader}>
                    <AppText style={styles.rowLabel}>
                      Maximal {rules.laufendeMax} Laufende
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Maximallaufende verringern"
                      disabled={rules.laufendeMax <= rules.laufendeMin}
                      style={styles.stepButton}
                      onPress={() =>
                        changeRules({ laufendeMax: rules.laufendeMax - 1 })
                      }
                    >
                      <AppText>−</AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Maximallaufende erhöhen"
                      disabled={rules.laufendeMax >= 14}
                      style={styles.stepButton}
                      onPress={() =>
                        changeRules({ laufendeMax: rules.laufendeMax + 1 })
                      }
                    >
                      <AppText>+</AppText>
                    </Pressable>
                  </View>
                </>
              ) : null}
              {expandedRules === 'ramsch' ? (
                <>
                  <View style={styles.ruleHeader}>
                    <AppText style={styles.rowLabel}>
                      Jungfrauen verdoppeln
                    </AppText>
                    <Switch
                      accessibilityLabel="Ramsch Jungfrauen erlauben"
                      value={rules.ramschJungfrau}
                      onValueChange={(ramschJungfrau) =>
                        changeRules({ ramschJungfrau })
                      }
                    />
                  </View>
                  <View style={styles.ruleHeader}>
                    <AppText style={styles.rowLabel}>
                      Durchmarsch erlauben
                    </AppText>
                    <Switch
                      accessibilityLabel="Ramsch Durchmarsch erlauben"
                      value={rules.ramschDurchmarsch}
                      onValueChange={(ramschDurchmarsch) =>
                        changeRules({ ramschDurchmarsch })
                      }
                    />
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setInfo(null)}
        transparent
        visible={info !== null}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setInfo(null)}
            style={styles.modalBackdrop}
          />
          <View style={styles.infoSheet}>
            <View style={styles.infoHeader}>
              <View>
                <AppText style={styles.infoKicker}>Regelinfo</AppText>
                <AppText style={styles.infoTitle}>{info?.label}</AppText>
              </View>
              <Pressable
                accessibilityLabel="Info schließen"
                accessibilityRole="button"
                onPress={() => setInfo(null)}
                style={({ pressed }) => [
                  styles.infoClose,
                  pressed && styles.pressed,
                ]}
              >
                <X
                  color={authColors.goldHighlight}
                  size={20}
                  strokeWidth={2.5}
                />
              </Pressable>
            </View>
            <AppText style={styles.infoDescription}>
              {info?.description ?? ''}
            </AppText>
          </View>
        </View>
      </Modal>
    </>
  );
});

type SettingRowProps = {
  definition: TableSettingDefinition<TableGameTypeId | BonusRuleId>;
  entry: TableSettingEntry;
  onInfo: () => void;
  onToggle: (enabled: boolean) => void;
  onValueChange: (value: number) => void;
};

const SettingRow = memo(function SettingRow({
  definition,
  entry,
  onInfo,
  onToggle,
  onValueChange,
}: SettingRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.ruleHeader}>
        <Text style={[styles.rowLabel, !entry.enabled && styles.labelDisabled]}>
          {definition.label}
        </Text>
        <Pressable
          accessibilityLabel={`Info zu ${definition.label}`}
          accessibilityRole="button"
          onPress={onInfo}
          style={({ pressed }) => [
            styles.infoButton,
            pressed && styles.pressed,
          ]}
        >
          <Info color="rgba(245, 245, 245, 0.5)" size={19} strokeWidth={2} />
        </Pressable>
        <View style={styles.switchColumn}>
          <Switch
            accessibilityLabel={`${definition.label} aktivieren`}
            ios_backgroundColor="rgba(245, 245, 245, 0.2)"
            thumbColor="#F5F5F5"
            trackColor={{
              false: 'rgba(245, 245, 245, 0.18)',
              true: 'rgba(111, 169, 114, 0.85)',
            }}
            value={entry.enabled}
            onValueChange={onToggle}
          />
        </View>
      </View>
      <View style={styles.ruleContent}>
        <AppText style={styles.tariffLabel}>
          {entry.mode === 'multiplier' ? 'Spielwert' : 'Tarif'}
        </AppText>
        {entry.mode === 'multiplier' ? (
          <AppText style={styles.multiplierText}>
            Faktor {formatValue(entry.value, entry.mode)}
          </AppText>
        ) : (
          <View
            style={[styles.valueBox, !entry.enabled && styles.valueBoxDisabled]}
          >
            <Pressable
              accessibilityLabel={`${definition.label}: Tarif um 0,10 € senken`}
              accessibilityRole="button"
              accessibilityState={{
                disabled: !entry.enabled || entry.value <= 0,
              }}
              disabled={!entry.enabled || entry.value <= 0}
              onPress={() =>
                onValueChange(
                  Math.max(0, Math.round(entry.value * 100) - 10) / 100,
                )
              }
              style={({ pressed }) => [
                styles.stepButton,
                (!entry.enabled || entry.value <= 0) && styles.stepDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Minus color={authColors.goldHighlight} size={16} />
            </Pressable>
            <Text
              accessibilityLabel={`${definition.label}: ${formatValue(entry.value, entry.mode)} Euro`}
              style={styles.valueText}
            >
              {formatValue(entry.value, entry.mode)} €
            </Text>
            <Pressable
              accessibilityLabel={`${definition.label}: Tarif um 0,10 € erhöhen`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !entry.enabled }}
              disabled={!entry.enabled}
              onPress={() =>
                onValueChange((Math.round(entry.value * 100) + 10) / 100)
              }
              style={({ pressed }) => [
                styles.stepButton,
                !entry.enabled && styles.stepDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Plus color={authColors.goldHighlight} size={16} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  houseRuleButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#20372D',
  },
  root: {
    gap: authSpacing.xl,
  },
  section: {
    gap: authSpacing.md,
  },
  sectionTitle: {
    color: authColors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  rows: {
    gap: authSpacing.sm,
  },
  row: {
    backgroundColor: 'rgba(245, 245, 245, 0.035)',
    borderColor: 'rgba(245, 245, 245, 0.07)',
    borderWidth: 1,
    borderRadius: 18,
    gap: authSpacing.xs,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.xs,
    minHeight: 44,
  },
  rowLabel: {
    color: authColors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  labelDisabled: {
    color: 'rgba(245, 245, 245, 0.55)',
  },
  switchColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    width: 60,
  },
  ruleContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: authSpacing.sm,
    paddingBottom: authSpacing.xs,
  },
  tariffLabel: {
    color: 'rgba(245, 245, 245, 0.48)',
    fontSize: 12,
    fontWeight: '500',
  },
  valueBox: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    backgroundColor: 'rgba(7, 17, 11, 0.72)',
    borderColor: 'rgba(231, 198, 92, 0.16)',
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '100%',
  },
  valueBoxDisabled: {
    opacity: 0.6,
  },
  stepButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  stepDisabled: {
    opacity: 0.35,
  },
  valueText: {
    color: authColors.textPrimary,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 56,
    fontVariant: ['tabular-nums'],
  },
  multiplierText: {
    color: authColors.goldHighlight,
    fontSize: 14,
    lineHeight: 24,
  },
  infoButton: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  infoSheet: {
    backgroundColor: '#142A20',
    borderColor: 'rgba(231, 198, 92, 0.18)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    gap: authSpacing.lg,
    paddingBottom: authSpacing.xl,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.lg,
  },
  infoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoKicker: {
    color: authColors.goldHighlight,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoTitle: {
    color: authColors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  infoClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.07)',
    borderRadius: authRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  infoDescription: {
    color: 'rgba(245, 245, 245, 0.7)',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
});
