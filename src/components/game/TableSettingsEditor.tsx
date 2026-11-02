import { Info, Minus, Plus, X } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { stockMode } from '../../utils/stockRules';
import { AppText } from '../ui/AppText';

type TableSettingsEditorProps = {
  settings: TableSettings;
  stockBalanceCents?: number;
  onChange: (settings: TableSettings) => void;
};

type InfoState = {
  description: string;
  label: string;
  warning?: boolean;
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
  stockBalanceCents = 0,
  onChange,
}: TableSettingsEditorProps) {
  const { fontScale } = useWindowDimensions();
  const safeSettings = useMemo(
    () => normalizeTableSettings(settings),
    [settings],
  );
  const [modeError, setModeError] = useState('');
  const [info, setInfo] = useState<InfoState>(null);
  const mode = stockMode(safeSettings);
  const chooseMode = (nextMode: 'stock' | 'ramsch' | 'off') => {
    if (nextMode !== mode && stockBalanceCents > 0) {
      const description =
        'Der Stock ist noch gefüllt. Ein Wechsel ist erst bei 0,00 € möglich.';
      setModeError(description);
      setInfo({ label: 'Wechsel nicht möglich', description, warning: true });
      return;
    }
    setModeError('');
    if (
      (nextMode === 'stock' && safeSettings.games.ramsch.enabled) ||
      (nextMode === 'ramsch' && safeSettings.games.stock.enabled)
    ) {
      const activeLabel = nextMode === 'stock' ? 'Ramsch' : 'Stock';
      const nextLabel = nextMode === 'stock' ? 'Stock' : 'Ramsch';
      setInfo({
        label: `${activeLabel} ist bereits aktiv`,
        description: `Deaktiviere zuerst ${activeLabel}, um ${nextLabel} zu aktivieren. Es kann nur eine Weiter-Regel aktiv sein.`,
        warning: true,
      });
      return;
    }
    onChange({
      ...safeSettings,
      stockStakeConfigured:
        nextMode === 'stock' ? true : safeSettings.stockStakeConfigured,
      games: {
        ...safeSettings.games,
        stock: {
          ...safeSettings.games.stock,
          enabled: nextMode === 'stock',
          value:
            nextMode === 'stock' && safeSettings.stockStakeConfigured === false
              ? safeSettings.games.rufspiel.value
              : safeSettings.games.stock.value,
        },
        ramsch: {
          ...safeSettings.games.ramsch,
          enabled: nextMode === 'ramsch',
        },
      },
    });
  };
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

      if (group === 'games' && id === 'stock' && nextEntry.value !== undefined)
        nextSettings.stockStakeConfigured = true;
      onChange(nextSettings);
    },
    [onChange, safeSettings],
  );

  return (
    <>
      <View style={styles.root}>
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Wenn alle weiter sagen</AppText>
          <View
            style={{
              flexDirection: fontScale >= 1.3 ? 'column' : 'row',
              gap: 8,
            }}
          >
            {(
              [
                ['stock', 'Stock'],
                ['ramsch', 'Ramsch'],
                ['off', 'Beides aus'],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityLabel={`Weiter-Regel ${label}`}
                accessibilityState={{ checked: mode === id }}
                aria-checked={mode === id}
                onPress={() => chooseMode(id)}
                style={[
                  {
                    flex: fontScale >= 1.3 ? undefined : 1,
                    minWidth: 0,
                    minHeight: 44,
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderRadius: authRadius.md,
                    paddingHorizontal: 4,
                    paddingVertical: 10,
                    alignItems: 'center',
                    backgroundColor:
                      mode === id ? 'rgba(231,198,92,0.18)' : 'transparent',
                    borderColor:
                      mode === id
                        ? authColors.goldHighlight
                        : authColors.borderSoft,
                  },
                ]}
              >
                <AppText
                  style={{
                    fontSize: 14,
                    textAlign: 'center',
                    color:
                      mode === id
                        ? authColors.goldHighlight
                        : authColors.textSecondary,
                  }}
                >
                  {label}
                </AppText>
              </Pressable>
            ))}
          </View>
          {stockBalanceCents > 0 ? (
            <AppText style={styles.infoDescription}>
              Stock: {(stockBalanceCents / 100).toFixed(2).replace('.', ',')} €
              · Wechsel erst bei leerem Stock.
            </AppText>
          ) : null}
          {modeError ? (
            <AppText accessibilityRole="alert" style={styles.infoDescription}>
              {modeError}
            </AppText>
          ) : null}
          {mode === 'stock' ? (
            <AppText style={styles.infoDescription}>
              Einsatz pro Spieler. Beim Speichern wählst du, ob neue Tarife nur
              ab jetzt oder auch für bisherige Spiele gelten.
            </AppText>
          ) : null}
        </View>
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
                      definition.id === 'ramsch' || definition.id === 'stock'
                        ? chooseMode(enabled ? definition.id : 'off')
                        : updateEntry(section.type, definition.id, { enabled })
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
        <SafeAreaView
          style={[styles.modalRoot, info?.warning && styles.warningRoot]}
        >
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={() => setInfo(null)}
            style={styles.modalBackdrop}
          />
          {info?.warning ? (
            <View style={styles.warningDialog} accessibilityViewIsModal>
              <ScrollView
                style={styles.warningScroll}
                contentContainerStyle={styles.warningContent}
              >
                <AppText accessibilityRole="header" style={styles.warningTitle}>
                  {info.label}
                </AppText>
                <AppText
                  accessibilityRole="alert"
                  style={styles.warningDescription}
                >
                  {info.description}
                </AppText>
              </ScrollView>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Verstanden"
                onPress={() => setInfo(null)}
                style={({ pressed }) => [
                  styles.warningConfirm,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <AppText style={styles.warningConfirmText}>Verstanden</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.infoSheet}>
              <View style={styles.infoHeader}>
                <View style={styles.infoHeading}>
                  <AppText style={styles.infoKicker}>
                    {info?.warning ? 'Warnung' : 'Regelinfo'}
                  </AppText>
                  <AppText style={styles.infoTitle}>{info?.label}</AppText>
                </View>
                <Pressable
                  accessibilityLabel={
                    info?.warning ? 'Warnung schließen' : 'Info schließen'
                  }
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
              <AppText
                accessibilityRole={info?.warning ? 'alert' : undefined}
                style={styles.infoDescription}
              >
                {info?.description ?? ''}
              </AppText>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
});

type SettingRowProps = {
  hideToggle?: boolean;
  definition: TableSettingDefinition<TableGameTypeId | BonusRuleId>;
  entry: TableSettingEntry;
  onInfo: () => void;
  onToggle: (enabled: boolean) => void;
  onValueChange: (value: number) => void;
};

const SettingRow = memo(function SettingRow({
  hideToggle = false,
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
        {!hideToggle ? (
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
        ) : null}
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
    gap: authSpacing.sm,
  },
  infoHeading: { flex: 1, minWidth: 0 },
  warningRoot: { justifyContent: 'center', padding: authSpacing.xl },
  warningDialog: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: '#142A20',
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    padding: authSpacing.xl,
    gap: authSpacing.xl,
  },
  warningScroll: { flexGrow: 0, flexShrink: 1 },
  warningContent: { gap: authSpacing.md },
  warningTitle: {
    color: authColors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  warningDescription: {
    color: authColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  warningConfirm: {
    minHeight: 48,
    flexShrink: 0,
    padding: authSpacing.md,
    borderRadius: authRadius.sm,
    backgroundColor: authColors.goldHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningConfirmText: {
    color: authColors.onGold,
    fontSize: 16,
    fontWeight: '600',
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
