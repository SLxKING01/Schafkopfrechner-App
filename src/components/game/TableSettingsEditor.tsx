import { Info, X } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  bonusRuleDefinitions,
  gameRuleDefinitions,
  normalizeTableSettings,
  type TableSettingDefinition,
} from '../../constants/tableSettings';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import type {
  BonusRuleId,
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

function parseValue(value: string, mode: TableSettingEntry['mode']) {
  const normalizedValue = value.replace(/[^\d,.]/g, '').replace(',', '.');
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  if (mode === 'multiplier') {
    return Math.max(1, Math.round(parsedValue));
  }

  return Math.max(0, Math.round(parsedValue * 100) / 100);
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
        <View style={styles.tableHeader}>
          <AppText style={styles.headerText}>An / Aus</AppText>
          <AppText style={[styles.headerText, styles.nameColumn]}>
            Spielart
          </AppText>
          <AppText style={styles.headerText}>Tarif</AppText>
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
                      updateEntry(section.type, definition.id, { enabled })
                    }
                    onValueChange={(value) =>
                      updateEntry(section.type, definition.id, {
                        value: parseValue(value, entry.mode),
                      })
                    }
                  />
                );
              })}
            </View>
          </View>
        ))}
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
  onValueChange: (value: string) => void;
};

const SettingRow = memo(function SettingRow({
  definition,
  entry,
  onInfo,
  onToggle,
  onValueChange,
}: SettingRowProps) {
  return (
    <View style={[styles.row, !entry.enabled && styles.rowDisabled]}>
      <Switch
        ios_backgroundColor="rgba(245, 245, 245, 0.2)"
        thumbColor="#F5F5F5"
        trackColor={{
          false: 'rgba(245, 245, 245, 0.18)',
          true: 'rgba(111, 169, 114, 0.85)',
        }}
        value={entry.enabled}
        onValueChange={onToggle}
      />
      <Text numberOfLines={1} style={styles.rowLabel}>
        {definition.label}
      </Text>
      <View
        style={[styles.valueBox, !entry.enabled && styles.valueBoxDisabled]}
      >
        <TextInput
          editable={entry.enabled}
          keyboardAppearance="dark"
          keyboardType="decimal-pad"
          onChangeText={onValueChange}
          placeholder={entry.mode === 'multiplier' ? '2x' : '0,00'}
          placeholderTextColor="rgba(245, 245, 245, 0.28)"
          selectionColor={authColors.goldHighlight}
          style={[
            styles.valueInput,
            !entry.enabled && styles.valueInputDisabled,
          ]}
          value={entry.enabled ? formatValue(entry.value, entry.mode) : ''}
        />
      </View>
      <Pressable
        accessibilityLabel={`Info zu ${definition.label}`}
        accessibilityRole="button"
        onPress={onInfo}
        style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
      >
        <Info color="#6FA972" size={22} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    gap: authSpacing.xl,
  },
  tableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: authSpacing.md,
    paddingHorizontal: authSpacing.xs,
  },
  headerText: {
    color: authColors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    width: 74,
  },
  nameColumn: {
    flex: 1,
    width: 'auto',
  },
  section: {
    gap: authSpacing.md,
  },
  sectionTitle: {
    color: authColors.textPrimary,
    fontSize: 19,
    fontWeight: '900',
  },
  rows: {
    backgroundColor: 'rgba(245, 245, 245, 0.045)',
    borderColor: 'rgba(245, 245, 245, 0.08)',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: 'rgba(245, 245, 245, 0.075)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.md,
    minHeight: 72,
    paddingHorizontal: authSpacing.md,
  },
  rowDisabled: {
    opacity: 0.62,
  },
  rowLabel: {
    color: authColors.textPrimary,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  valueBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 17, 11, 0.72)',
    borderColor: 'rgba(231, 198, 92, 0.16)',
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 82,
  },
  valueBoxDisabled: {
    backgroundColor: 'rgba(245, 245, 245, 0.035)',
    borderColor: 'rgba(245, 245, 245, 0.09)',
  },
  valueInput: {
    color: authColors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    paddingHorizontal: authSpacing.sm,
    textAlign: 'right',
    width: '100%',
  },
  valueInputDisabled: {
    color: 'rgba(245, 245, 245, 0.28)',
  },
  infoButton: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    height: 42,
    justifyContent: 'center',
    width: 36,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
