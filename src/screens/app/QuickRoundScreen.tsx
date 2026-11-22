import { ChevronRight, Spade, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AppButton } from '../../components/ui/AppButton';
import { AppLogo } from '../../components/ui/AppLogo';
import { AppText } from '../../components/ui/AppText';
import { Notice } from '../../components/ui/Notice';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { AppStackScreenProps } from '../../navigation/types';
import {
  openSharedTable,
  refreshSharedTables,
} from '../../services/shared/sharedTables';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useTableVisibilityStore } from '../../store/tableVisibilityStore';
import {
  authColors as c,
  authRadius,
  authSpacing,
  authTextStyles,
} from '../../theme';
import { canOpenQuickRound, quickRoundTables } from '../../utils/quickRound';

type TableOption = ReturnType<typeof quickRoundTables>[number];

export function QuickRoundScreen({
  navigation,
}: AppStackScreenProps<'QuickRound'>) {
  const userId = useAuthStore((state) => state.user?.id);
  const [options, setOptions] = useState<TableOption[] | null>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);

  const open = useCallback(
    async (option: TableOption) => {
      if (busy.current || !navigation.isFocused()) return;
      busy.current = true;
      setOpening(true);
      setError('');
      try {
        if (option.shared) await openSharedTable(option.id);
        else if (useGameStore.getState().currentTable?.id !== option.id)
          useGameStore.getState().resumeTable(option.id);

        if (
          !navigation.isFocused() ||
          useAuthStore.getState().user?.id !== userId
        )
          return;
        const { currentTable, players, activeGame } = useGameStore.getState();
        if (
          currentTable?.id !== option.id ||
          !canOpenQuickRound(currentTable, players, activeGame, userId)
        )
          throw new Error(
            'Für diesen Tisch ist die Spieleingabe derzeit nicht verfügbar.',
          );
        navigation.popTo('ActiveGame', { quickRound: option.id });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Der Tisch konnte nicht geöffnet werden.',
        );
      } finally {
        busy.current = false;
        setOpening(false);
      }
    },
    [navigation, userId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const visibility = useTableVisibilityStore.getState();
        await visibility.hydrate();
        // Guests only have local tables, so there is nothing to fetch.
        const shared =
          userId && isSupabaseConfigured ? await refreshSharedTables() : [];
        if (
          cancelled ||
          !navigation.isFocused() ||
          useAuthStore.getState().user?.id !== userId
        )
          return;
        const tables = quickRoundTables(
          useGameStore.getState(),
          shared ?? [],
          userId,
          useTableVisibilityStore.getState().hiddenByScope[
            userId ? `user:${userId}` : 'guest'
          ] ?? [],
        );
        setOptions(tables);
        if (!shared)
          setError('Gemeinsame Tische konnten nicht geprüft werden.');
        else if (tables.length === 1) void open(tables[0]);
      } catch {
        if (!cancelled) {
          setOptions([]);
          setError('Die laufenden Tische konnten nicht geprüft werden.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, navigation, open, userId]);

  const checking = options === null || opening;
  return (
    <AuthBackground withEdgeBorder={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AppLogo size={64} />
          <AppText accessibilityRole="header" style={styles.title}>
            Spiel eintragen
          </AppText>
          <AppText style={styles.subtitle}>
            {checking
              ? 'Laufender Tisch wird geprüft …'
              : options.length
                ? 'Für welchen Tisch?'
                : 'Gerade läuft kein Tisch, an dem du Spiele eintragen kannst.'}
          </AppText>
        </View>
        {checking ? (
          <ActivityIndicator
            accessibilityLabel="Wird geprüft"
            color={c.gold}
            size="large"
          />
        ) : null}
        {error ? <Notice>{error}</Notice> : null}
        {options?.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`${option.name}, ${option.players.join(', ')}`}
            disabled={opening}
            onPress={() => void open(option)}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.pressed,
              opening && styles.disabled,
            ]}
          >
            <View style={styles.icon}>
              {option.shared ? (
                <Users color={c.goldHighlight} size={20} strokeWidth={2.3} />
              ) : (
                <Spade color={c.goldHighlight} size={20} strokeWidth={2.3} />
              )}
            </View>
            <View style={styles.cardCopy}>
              <AppText style={styles.cardTitle} numberOfLines={1}>
                {option.name}
              </AppText>
              <AppText style={styles.cardPlayers} numberOfLines={1}>
                {option.players.join(' · ')}
              </AppText>
              <AppText style={styles.cardMeta}>
                {[
                  option.nextGame ? `Spiel ${option.nextGame}` : null,
                  option.shared ? 'gemeinsam' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </View>
            <ChevronRight color={c.textSecondary} size={20} />
          </Pressable>
        ))}
        {error ? (
          <AppButton
            title="Erneut prüfen"
            variant="secondary"
            disabled={opening}
            onPress={() => {
              setOptions(null);
              setError('');
              setAttempt((value) => value + 1);
            }}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zur Tischübersicht"
          disabled={opening}
          onPress={() =>
            navigation.navigate('AppTabs', { screen: 'GameLobby' })
          }
          style={({ pressed }) => [
            styles.textButton,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.textButtonLabel}>Zur Tischübersicht</AppText>
        </Pressable>
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: authSpacing.md,
    padding: authSpacing.xl,
    paddingTop: authSpacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    gap: authSpacing.sm,
    marginBottom: authSpacing.lg,
  },
  title: { ...authTextStyles.pageTitle, textAlign: 'center' },
  subtitle: {
    ...authTextStyles.body,
    color: c.textSecondary,
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
    backgroundColor: c.surfaceElevated,
    borderColor: c.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.md,
    padding: authSpacing.lg,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: c.borderGold,
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  cardCopy: { flex: 1, gap: 2, minWidth: 0 },
  cardTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '700' },
  cardPlayers: { ...authTextStyles.caption, color: c.textSecondary },
  cardMeta: {
    ...authTextStyles.caption,
    color: c.goldHighlight,
    fontWeight: '600',
  },
  textButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  textButtonLabel: { color: c.goldHighlight, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
