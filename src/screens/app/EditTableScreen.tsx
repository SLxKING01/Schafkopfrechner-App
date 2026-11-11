import { LinearGradient } from 'expo-linear-gradient';
import { Check, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { PlayerAccountsEditor } from '../../components/game/PlayerAccountsEditor';
import { TableSettingsEditor } from '../../components/game/TableSettingsEditor';
import { AppText } from '../../components/ui/AppText';
import { normalizeTableSettings } from '../../constants/tableSettings';
import { appAlert } from '../../lib/appAlert';
import type { AppStackScreenProps } from '../../navigation/types';
import { fingerprint } from '../../services/sync/syncGameState';
import { reliableStorage } from '../../storage/reliableStorage';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { formEntering } from '../../theme/motion';
import { authRadius, authSpacing } from '../../theme/spacing';
import type { TableSettings } from '../../types/game';
import { getStockBalanceCents } from '../../utils/accounting';
import { tableAccess } from '../../utils/tableAccess';

type EditTableScreenProps = AppStackScreenProps<'EditTable'>;

const screenColors = {
  background: '#0B1D16',
  backgroundMid: '#10241C',
  backgroundSoft: '#163328',
  gold: '#E7C65C',
  text: '#F5F5F5',
  muted: 'rgba(245, 245, 245, 0.62)',
  border: 'rgba(231, 198, 92, 0.24)',
  shadow: '#000000',
};

export function EditTableScreen({ navigation }: EditTableScreenProps) {
  const currentTable = useGameStore((state) => state.currentTable);
  const actorId = useAuthStore((state) => state.user?.id);
  const { canManage } = tableAccess(currentTable, actorId);
  const updateCurrentTableSettings = useGameStore(
    (state) => state.updateCurrentTableSettings,
  );
  const initialSettings = useMemo(
    () => normalizeTableSettings(currentTable?.settings),
    [currentTable?.settings],
  );
  const [editingTableId] = useState(currentTable?.id);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const rounds = useGameStore((state) => state.rounds);
  const [settings, setSettings] = useState<TableSettings>(initialSettings);
  const [pricingChoice, setPricingChoice] = useState(false);
  const initialSignature = useRef(fingerprint(initialSettings));
  const applied = useRef<string | undefined>(undefined);

  const saveSettings = async (scope: 'future' | 'all') => {
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    try {
      if (useGameStore.getState().currentTable?.id !== editingTableId)
        throw new Error(
          'Der aktive Tisch hat sich geändert. Bitte die Einstellungen erneut öffnen.',
        );
      const state = useGameStore.getState();
      if (
        applied.current
          ? applied.current !==
            fingerprint([state.currentTable?.settings, state.rounds])
          : initialSignature.current !==
            fingerprint(state.currentTable?.settings)
      )
        throw new Error(
          'Tarife oder Spiele wurden inzwischen geändert. Bitte die Einstellungen schließen und erneut öffnen.',
        );
      if (!applied.current && !updateCurrentTableSettings(settings, scope))
        throw new Error(
          useGameStore.getState().roundError ??
            'Stock und Ramsch müssen sich ausschließen. Bei gefülltem Stock ist ein Wechsel erst nach dessen Ausspielen oder Verteilen möglich.',
        );
      applied.current = fingerprint([
        useGameStore.getState().currentTable?.settings,
        useGameStore.getState().rounds,
      ]);
      await reliableStorage.retryWrites();
      if (!(await reliableStorage.confirmWrite('schafkopfrechner-games')))
        throw new Error(
          'Die Einstellungen sind noch nicht auf dem Gerät gesichert. Bitte erneut speichern.',
        );
      navigation.goBack();
    } catch (error) {
      appAlert(
        'Einstellungen nicht gespeichert',
        error instanceof Error ? error.message : 'Bitte erneut versuchen.',
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };
  const requestSave = () => {
    if (savingLock.current) return;
    const tariffSignature = (value: TableSettings) =>
      fingerprint(
        [value.games, value.bonusRules].map((entries) =>
          Object.entries(entries)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([id, entry]) => [id, entry.value, entry.mode]),
        ),
      );
    if (
      !applied.current &&
      rounds.length &&
      tariffSignature(initialSettings) !== tariffSignature(settings)
    )
      setPricingChoice(true);
    else void saveSettings('future');
  };

  return (
    <AuthBackground>
      <LinearGradient
        colors={[
          screenColors.background,
          screenColors.backgroundMid,
          screenColors.backgroundSoft,
        ]}
        locations={[0, 0.5, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.goldGlow} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={formEntering} style={styles.header}>
          <View style={styles.titleBlock}>
            <AppText style={styles.kicker}>Tisch bearbeiten</AppText>
            <AppText style={styles.title}>Regeln & Tarife</AppText>
            <AppText style={styles.subtitle}>
              {currentTable?.name ?? 'Aktiver Tisch'}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Schließen"
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <X color={screenColors.gold} size={22} strokeWidth={2.5} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={formEntering} style={styles.settingsCard}>
          {!canManage ? (
            <AppText>Regeln können nur vom Ersteller geändert werden.</AppText>
          ) : null}
          <View
            pointerEvents={canManage ? 'auto' : 'none'}
            accessibilityElementsHidden={!canManage}
          >
            <TableSettingsEditor
              settings={settings}
              stockBalanceCents={getStockBalanceCents(rounds)}
              onChange={setSettings}
            />
          </View>
          {canManage && actorId && currentTable && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('TableInvitations', {
                  tableId: currentTable.id,
                })
              }
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <AppText>Freunde zu diesem Tisch einladen</AppText>
            </Pressable>
          )}
          <PlayerAccountsEditor />
        </Animated.View>
      </ScrollView>

      <View style={styles.bottomActions}>
        <Pressable
          accessibilityLabel="Abbrechen"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.floatingButton,
            styles.cancelFloating,
            pressed && styles.floatingPressed,
          ]}
        >
          <X color={screenColors.muted} size={28} strokeWidth={2.7} />
        </Pressable>
        <Pressable
          accessibilityLabel="Regeln speichern"
          accessibilityRole="button"
          disabled={saving || !canManage}
          onPress={requestSave}
          style={({ pressed }) => [
            styles.floatingButton,
            styles.saveFloating,
            pressed && styles.floatingPressed,
          ]}
        >
          <Check color="#17150B" size={30} strokeWidth={3} />
        </Pressable>
      </View>
      <Modal
        transparent
        visible={pricingChoice}
        animationType="none"
        onRequestClose={() => setPricingChoice(false)}
      >
        <SafeAreaView style={styles.pricingRoot}>
          <ScrollView contentContainerStyle={styles.pricingScroll}>
            <View style={styles.pricingCard} accessibilityViewIsModal>
              <AppText accessibilityRole="header" style={styles.title}>
                Ab wann gelten die neuen Tarife?
              </AppText>
              <AppText style={styles.subtitle}>
                Nur für neue Spiele oder auch rückwirkend für alle bisherigen
                Spiele dieses Tisches? Manuell eingetragene Beträge bleiben
                unverändert.
              </AppText>
              <GoldButton
                title="Ab jetzt"
                onPress={() => {
                  setPricingChoice(false);
                  void saveSettings('future');
                }}
              />
              <GoldButton
                title="Auch bisherige Spiele"
                onPress={() => {
                  setPricingChoice(false);
                  void saveSettings('all');
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tarifänderung abbrechen"
                onPress={() => setPricingChoice(false)}
                style={styles.pricingCancel}
              >
                <AppText style={styles.subtitle}>Abbrechen</AppText>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  pricingRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  pricingScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: authSpacing.xl,
  },
  pricingCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: screenColors.backgroundMid,
    borderRadius: authRadius.lg,
    padding: authSpacing.lg,
    gap: authSpacing.lg,
  },
  pricingCancel: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 134,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.lg,
  },
  goldGlow: {
    backgroundColor: 'rgba(231, 198, 92, 0.11)',
    borderRadius: 140,
    height: 280,
    position: 'absolute',
    right: -130,
    top: -70,
    width: 280,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 86,
  },
  titleBlock: {
    flex: 1,
    paddingRight: authSpacing.md,
  },
  kicker: {
    color: screenColors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: screenColors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: authSpacing.xs,
  },
  subtitle: {
    color: screenColors.muted,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(26, 45, 36, 0.72)',
    borderColor: screenColors.border,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  settingsCard: {
    backgroundColor: 'rgba(26, 45, 36, 0.96)',
    borderColor: screenColors.border,
    borderRadius: 32,
    borderWidth: 1,
    elevation: 12,
    marginTop: authSpacing.xl,
    padding: authSpacing.lg,
    shadowColor: screenColors.shadow,
    shadowOffset: { height: 20, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
  },
  bottomActions: {
    alignItems: 'center',
    bottom: authSpacing.xl,
    flexDirection: 'row',
    gap: authSpacing.xxl,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  floatingButton: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    elevation: 12,
    height: 70,
    justifyContent: 'center',
    shadowColor: screenColors.shadow,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    width: 70,
  },
  cancelFloating: {
    backgroundColor: 'rgba(245, 245, 245, 0.1)',
    borderColor: 'rgba(245, 245, 245, 0.12)',
    borderWidth: 1,
  },
  saveFloating: {
    backgroundColor: '#6FA972',
    shadowColor: '#6FA972',
    shadowOpacity: 0.32,
  },
  floatingPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.94 }],
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});
