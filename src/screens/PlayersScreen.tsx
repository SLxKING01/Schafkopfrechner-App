import { useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { AppText } from '../components/ui/AppText';
import { theme } from '../constants/theme';
import type { Player } from '../models/Player';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { winningIds } from '../utils/winningParty';

export function PlayersScreen() {
  const games = useGameStore((state) => state.games);
  const [playerName, setPlayerName] = useState('');
  const players = usePlayerStore((state) => state.players);
  const addPlayer = usePlayerStore((state) => state.addPlayer);
  const removePlayer = usePlayerStore((state) => state.removePlayer);

  function handleAddPlayer() {
    addPlayer(playerName);
    setPlayerName('');
  }

  function renderPlayer({ item }: { item: Player }) {
    return (
      <AppCard style={styles.playerRow}>
        <AppText style={styles.playerName}>{item.name}</AppText>
        <AppButton
          title={
            games.some(
              (game) =>
                winningIds(game).includes(item.id) ||
                game.loserIds.includes(item.id),
            )
              ? 'In Spielen verwendet'
              : 'Löschen'
          }
          disabled={games.some(
            (game) =>
              winningIds(game).includes(item.id) ||
              game.loserIds.includes(item.id),
          )}
          variant="danger"
          onPress={() => removePlayer(item.id)}
        />
      </AppCard>
    );
  }

  return (
    <View style={styles.container}>
      <AppCard style={styles.form}>
        <TextInput
          style={styles.input}
          value={playerName}
          onChangeText={setPlayerName}
          placeholder="Spielername"
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleAddPlayer}
        />
        <AppButton title="Spieler hinzufügen" onPress={handleAddPlayer} />
      </AppCard>

      {players.length === 0 ? (
        <EmptyState
          title="Noch keine Spieler"
          message="Füge die Mitspieler hinzu, dann kannst du Spiele erfassen."
        />
      ) : (
        <FlatList
          data={players}
          keyExtractor={(player) => player.id}
          renderItem={renderPlayer}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    padding: theme.spacing.xl,
  },
  form: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  input: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  list: {
    gap: theme.spacing.md,
  },
  playerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  playerName: {
    flex: 1,
  },
});
