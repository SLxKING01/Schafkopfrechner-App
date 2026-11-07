import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { AppStackScreenProps } from '../../navigation/types';
import {
  openSharedTable,
  refreshSharedTables,
} from '../../services/shared/sharedTables';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useTableVisibilityStore } from '../../store/tableVisibilityStore';
import { authSpacing } from '../../theme/spacing';
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
      if (busy.current || !userId || !navigation.isFocused()) return;
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
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const visibility = useTableVisibilityStore.getState();
        await visibility.hydrate();
        const shared = isSupabaseConfigured ? await refreshSharedTables() : [];
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
          useTableVisibilityStore.getState().hiddenByScope[`user:${userId}`] ??
            [],
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

  return (
    <AuthBackground withEdgeBorder={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText>
          {options === null || opening
            ? 'Laufender Tisch wird geprüft …'
            : options.length
              ? 'Wähle einen Tisch für die Spieleingabe.'
              : 'Es ist kein laufender Tisch mit verfügbarer Spieleingabe vorhanden.'}
        </AppText>
        {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
        {options?.map((option) => (
          <AppButton
            key={option.id}
            title={option.name}
            disabled={opening}
            onPress={() => void open(option)}
          />
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
        <AppButton
          title="Zur Tischübersicht"
          variant="secondary"
          disabled={opening}
          onPress={() =>
            navigation.navigate('AppTabs', { screen: 'GameLobby' })
          }
        />
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: authSpacing.xl, gap: authSpacing.md },
});
