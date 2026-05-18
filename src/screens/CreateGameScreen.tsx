import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { GameTypeCard } from '../components/GameTypeCard';
import { OptionToggle } from '../components/OptionToggle';
import { PlayerChip } from '../components/PlayerChip';
import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { AppSection } from '../components/ui/AppSection';
import { AppText } from '../components/ui/AppText';
import { DEFAULT_GAME_TYPE_ID, GAME_TYPES } from '../constants/gameTypes';
import { theme } from '../constants/theme';
import type { MainTabParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import { calculateGameAmount } from '../utils/calculateGameAmount';
import {
  DEFAULT_GAME_OPTIONS,
  normalizeGameOptions,
} from '../utils/formatGameOptions';

type CreateGameScreenProps = BottomTabScreenProps<
  MainTabParamList,
  'CreateGame'
>;

export function CreateGameScreen({ navigation, route }: CreateGameScreenProps) {
  const [winnerId, setWinnerId] = useState('');
  const [loserIds, setLoserIds] = useState<string[]>([]);
  const [gameTypeId, setGameTypeId] = useState(DEFAULT_GAME_TYPE_ID);
  const [laufende, setLaufende] = useState(DEFAULT_GAME_OPTIONS.laufende);
  const [schneider, setSchneider] = useState(DEFAULT_GAME_OPTIONS.schneider);
  const [schwarz, setSchwarz] = useState(DEFAULT_GAME_OPTIONS.schwarz);
  const games = useGameStore((state) => state.games);
  const players = usePlayerStore((state) => state.players);
  const addGame = useGameStore((state) => state.addGame);
  const updateGame = useGameStore((state) => state.updateGame);
  const activeMatchDayId = useMatchDayStore((state) => state.activeMatchDayId);
  const matchDays = useMatchDayStore((state) => state.matchDays);
  const activeMatchDay = matchDays.find(
    (matchDay) => matchDay.id === activeMatchDayId,
  );
  const editGameId = route.params?.gameId;
  const editingGame = useMemo(
    () => games.find((game) => game.id === editGameId),
    [games, editGameId],
  );
  const isEditMode = Boolean(editGameId && editingGame);
  const hasInvalidEditGame = Boolean(editGameId && !editingGame);

  useEffect(() => {
    if (!editingGame) {
      return;
    }

    const editingOptions = normalizeGameOptions(editingGame.options);

    setWinnerId(editingGame.winnerId);
    setLoserIds(editingGame.loserIds);
    setGameTypeId(editingGame.gameTypeId ?? DEFAULT_GAME_TYPE_ID);
    setLaufende(editingOptions.laufende);
    setSchneider(editingOptions.schneider);
    setSchwarz(editingOptions.schwarz);
  }, [editingGame]);

  const options = {
    laufende,
    schneider,
    schwarz,
  };
  const calculatedAmount = calculateGameAmount(gameTypeId, options);
  const canSave =
    Boolean(activeMatchDayId) &&
    !activeMatchDay?.isClosed &&
    Boolean(winnerId) &&
    loserIds.length > 0 &&
    calculatedAmount > 0;

  function handleSelectWinner(id: string) {
    setWinnerId(id);
    setLoserIds((currentLoserIds) =>
      currentLoserIds.filter((loserId) => loserId !== id),
    );
  }

  function handleToggleLoser(id: string) {
    if (id === winnerId) {
      return;
    }

    setLoserIds((currentLoserIds) =>
      currentLoserIds.includes(id)
        ? currentLoserIds.filter((loserId) => loserId !== id)
        : [...currentLoserIds, id],
    );
  }

  function handleDecreaseLaufende() {
    setLaufende((currentLaufende) => Math.max(0, currentLaufende - 1));
  }

  function handleIncreaseLaufende() {
    setLaufende((currentLaufende) => currentLaufende + 1);
  }

  function handleSaveGame() {
    const didSave =
      isEditMode && editingGame
        ? updateGame({
            ...editingGame,
            winnerId,
            loserIds,
            amount: calculatedAmount,
            gameTypeId,
            options,
          })
        : addGame({
            winnerId,
            loserIds,
            amount: calculatedAmount,
            gameTypeId,
            options,
            matchDayId: activeMatchDayId ?? undefined,
          });

    if (didSave) {
      navigation.setParams({ gameId: undefined });
      setWinnerId('');
      setLoserIds([]);
      setGameTypeId(DEFAULT_GAME_TYPE_ID);
      setLaufende(DEFAULT_GAME_OPTIONS.laufende);
      setSchneider(DEFAULT_GAME_OPTIONS.schneider);
      setSchwarz(DEFAULT_GAME_OPTIONS.schwarz);
      navigation.navigate('Games');
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {activeMatchDay?.isClosed ? (
          <AppCard>
            <AppText style={styles.closedText}>
              Dieser Spieltag ist abgeschlossen.
            </AppText>
          </AppCard>
        ) : null}

        {hasInvalidEditGame ? (
          <EmptyState
            title="Spiel nicht gefunden"
            message="Das ausgewählte Spiel existiert nicht mehr. Du kannst stattdessen ein neues Spiel erfassen."
            actionLabel="Neues Spiel starten"
            onAction={() => navigation.setParams({ gameId: undefined })}
          />
        ) : null}

        {players.length === 0 ? (
          <EmptyState
            title="Noch keine Spieler"
            message="Lege zuerst Spieler an, damit du ein Spiel erfassen kannst."
            actionLabel="Zu Spieler wechseln"
            onAction={() => navigation.navigate('Players')}
          />
        ) : null}

        <AppCard style={styles.amountCard}>
          <AppText variant="caption">Live-Betrag</AppText>
          <AppText style={styles.amountValue}>
            {calculatedAmount} \u20ac
          </AppText>
          {isEditMode ? (
            <AppText variant="caption">Bearbeitungsmodus</AppText>
          ) : null}
        </AppCard>

        <AppSection title="Spieltyp">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {GAME_TYPES.map((gameType) => (
              <GameTypeCard
                key={gameType.id}
                gameType={gameType}
                isSelected={gameType.id === gameTypeId}
                onPress={() => setGameTypeId(gameType.id)}
              />
            ))}
          </ScrollView>
        </AppSection>

        <AppSection title="Gewinner">
          <View style={styles.chipGrid}>
            {players.map((player) => (
              <PlayerChip
                key={player.id}
                name={player.name}
                isSelected={player.id === winnerId}
                onPress={() => handleSelectWinner(player.id)}
              />
            ))}
          </View>
        </AppSection>

        <AppSection title="Verlierer">
          <View style={styles.chipGrid}>
            {players.map((player) => (
              <PlayerChip
                key={player.id}
                name={player.name}
                variant="danger"
                isSelected={loserIds.includes(player.id)}
                onPress={() => handleToggleLoser(player.id)}
                disabled={player.id === winnerId}
              />
            ))}
          </View>
        </AppSection>

        <AppSection title="Optionen">
          <AppCard style={styles.stepperCard}>
            <AppText variant="subtitle">Laufende</AppText>
            <View style={styles.stepper}>
              <AppButton
                title="-"
                variant="secondary"
                onPress={handleDecreaseLaufende}
                disabled={laufende === 0}
                style={styles.stepperButton}
              />
              <AppText style={styles.stepperValue}>{laufende}</AppText>
              <AppButton
                title="+"
                variant="secondary"
                onPress={handleIncreaseLaufende}
                style={styles.stepperButton}
              />
            </View>
          </AppCard>

          <View style={styles.toggleRow}>
            <OptionToggle
              title="Schneider"
              isActive={schneider}
              onPress={() => setSchneider((current) => !current)}
            />
            <OptionToggle
              title="Schwarz"
              isActive={schwarz}
              onPress={() => setSchwarz((current) => !current)}
            />
          </View>
        </AppSection>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <AppText variant="caption">Zu speichern</AppText>
          <AppText variant="subtitle">{calculatedAmount} \u20ac</AppText>
        </View>
        <AppButton
          title={isEditMode ? 'Änderungen speichern' : 'Spiel speichern'}
          onPress={handleSaveGame}
          disabled={!canSave}
          style={styles.saveButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
    paddingBottom: 120,
  },
  closedText: {
    color: theme.colors.negative,
    fontWeight: '600',
  },
  amountCard: {
    gap: theme.spacing.xs,
  },
  amountValue: {
    color: theme.colors.primary,
    fontSize: 40,
    fontWeight: '800',
  },
  horizontalList: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xl,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  stepperCard: {
    gap: theme.spacing.md,
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.lg,
    justifyContent: 'space-between',
  },
  stepperButton: {
    minWidth: 72,
  },
  stepperValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
    left: 0,
    padding: theme.spacing.lg,
    position: 'absolute',
    right: 0,
  },
  saveButton: {
    flex: 1,
  },
});
