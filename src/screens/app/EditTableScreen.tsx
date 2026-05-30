import { LinearGradient } from 'expo-linear-gradient';
import { Check, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { TableSettingsEditor } from '../../components/game/TableSettingsEditor';
import { AppText } from '../../components/ui/AppText';
import { normalizeTableSettings } from '../../constants/tableSettings';
import type { AppStackScreenProps } from '../../navigation/types';
import { useGameStore } from '../../store/gameStore';
import { authRadius, authSpacing } from '../../theme/spacing';
import type { TableSettings } from '../../types/game';

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
  const updateCurrentTableSettings = useGameStore(
    (state) => state.updateCurrentTableSettings,
  );
  const initialSettings = useMemo(
    () => normalizeTableSettings(currentTable?.settings),
    [currentTable?.settings],
  );
  const [settings, setSettings] = useState<TableSettings>(initialSettings);

  const saveSettings = () => {
    const didUpdate = updateCurrentTableSettings(settings);

    if (!didUpdate) {
      Alert.alert('Kein Tisch aktiv', 'Erstelle zuerst einen Tisch.');
      return;
    }

    navigation.goBack();
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
        <Animated.View
          entering={FadeInDown.duration(360)}
          style={styles.header}
        >
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

        <Animated.View
          entering={FadeInDown.duration(420).delay(80)}
          style={styles.settingsCard}
        >
          <TableSettingsEditor settings={settings} onChange={setSettings} />
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
          onPress={saveSettings}
          style={({ pressed }) => [
            styles.floatingButton,
            styles.saveFloating,
            pressed && styles.floatingPressed,
          ]}
        >
          <Check color="#17150B" size={30} strokeWidth={3} />
        </Pressable>
      </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
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
