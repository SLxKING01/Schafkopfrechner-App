import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { AppText } from '../components/ui/AppText';
import { theme } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { winningIds } from '../utils/winningParty';

export function PlayersScreen() {
  const games = useGameStore((state) => state.games);
  const players = usePlayerStore((state) => state.players);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  function addPlayer() {
    if (!name.trim()) {
      setError('Bitte einen Spielernamen eingeben.');
      return;
    }
    if (
      players.some(
        (player) =>
          player.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
    ) {
      setError(
        'Dieser Name ist schon vorhanden. Bitte einen unterscheidbaren Namen verwenden.',
      );
      return;
    }
    usePlayerStore.getState().addPlayer(name);
    setName('');
    setError('');
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : Platform.OS === 'android'
            ? 'height'
            : undefined
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <AppCard>
          <AppText>Spielername</AppText>
          <TextInput
            accessibilityLabel="Spielername"
            placeholder="Spielername"
            style={styles.input}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={addPlayer}
          />
          {error ? <AppText>{error}</AppText> : null}
          <AppButton title="Spieler hinzufügen" onPress={addPlayer} />
        </AppCard>
        {!players.length ? (
          <AppText>
            Füge die Mitspieler hinzu, dann kannst du Spiele erfassen.
          </AppText>
        ) : null}
        {players.map((player) => {
          const used = games.some(
            (game) =>
              winningIds(game).includes(player.id) ||
              game.loserIds.includes(player.id),
          );
          return (
            <AppCard key={player.id}>
              <AppText variant="subtitle">{player.name}</AppText>
              <View style={{ marginTop: 8 }}>
                <AppButton
                  title={`${player.name} löschen`}
                  variant="danger"
                  disabled={used}
                  onPress={() =>
                    usePlayerStore.getState().removePlayer(player.id)
                  }
                />
              </View>
              {used ? (
                <AppText variant="caption">
                  In Spielen verwendet. Löschen ist gesperrt, damit Namen,
                  Salden und Zahlungen erhalten bleiben.
                </AppText>
              ) : null}
            </AppCard>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  content: {
    padding: 24,
    paddingBottom: 100,
    gap: 16,
    backgroundColor: theme.colors.background,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    fontSize: 16,
    marginVertical: 12,
  },
});
