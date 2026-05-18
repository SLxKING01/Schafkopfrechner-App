import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { AddPlayerModal } from '../../components/game/AddPlayerModal';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { PlayerChip } from '../../components/game/PlayerChip';
import { AppText } from '../../components/ui/AppText';
import type { AppStackScreenProps } from '../../navigation/types';
import { createLocalPlayer } from '../../services/game/addPlayer';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { Player } from '../../types/game';

type CreateTableScreenProps = AppStackScreenProps<'CreateTable'>;

export function CreateTableScreen({ navigation }: CreateTableScreenProps) {
  const [tableName, setTableName] = useState('Schafkopf Abend');
  const [players, setPlayers] = useState<Player[]>([
    createLocalPlayer('Simon'),
    createLocalPlayer('Max'),
  ]);
  const [modalVisible, setModalVisible] = useState(false);
  const createTable = useGameStore((state) => state.createTable);

  function addPlayer(name: string) {
    const playerName = name.trim();
    const exists = players.some(
      (player) => player.name.toLowerCase() === playerName.toLowerCase(),
    );

    if (!playerName || exists) {
      return false;
    }

    setPlayers((currentPlayers) => [
      ...currentPlayers,
      createLocalPlayer(playerName),
    ]);
    return true;
  }

  function removePlayer(id: string) {
    setPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== id),
    );
  }

  function startGame() {
    const didCreate = createTable(tableName, players);

    if (!didCreate) {
      Alert.alert(
        'Tisch nicht bereit',
        'Bitte Tischname und mindestens zwei Spieler anlegen.',
      );
      return;
    }

    navigation.replace('ActiveGame');
  }

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>Neuer Tisch</AppText>
        <AppText style={styles.title}>Spielabend erstellen</AppText>
        <AppText style={styles.subtitle}>
          Lokale Spieler reichen fuer den MVP. Freunde aus Supabase kommen
          spaeter dazu.
        </AppText>

        <View style={styles.card}>
          <AppText style={styles.label}>Tischname</AppText>
          <TextInput
            placeholder="Tischname"
            placeholderTextColor={authColors.textSecondary}
            selectionColor={authColors.gold}
            style={styles.input}
            value={tableName}
            onChangeText={setTableName}
          />
        </View>

        <SectionHeader title="Spieler" action={`${players.length} am Tisch`} />
        {players.length === 0 ? (
          <EmptyGameState
            icon={Users}
            title="Noch keine Spieler"
            message="Fuege lokale Spieler hinzu, um den Tisch zu starten."
          />
        ) : (
          <View style={styles.chipWrap}>
            {players.map((player) => (
              <PlayerChip
                key={player.id}
                name={player.name}
                removable
                onRemove={() => removePlayer(player.id)}
              />
            ))}
          </View>
        )}

        <GoldButton
          title="Spieler hinzufuegen"
          onPress={() => setModalVisible(true)}
        />
      </ScrollView>

      <View style={styles.floatingCta}>
        <GoldButton title="Spiel starten" onPress={startGame} />
      </View>

      <AddPlayerModal
        visible={modalVisible}
        onAddPlayer={addPlayer}
        onClose={() => setModalVisible(false)}
      />
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 150,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.xl,
  },
  kicker: {
    color: authColors.goldHighlight,
    fontSize: authTypography.caption,
    fontWeight: '900',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.hero,
    fontWeight: '900',
    marginTop: authSpacing.sm,
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.body,
    lineHeight: 23,
    marginTop: authSpacing.sm,
  },
  card: {
    backgroundColor: 'rgba(13, 27, 19, 0.78)',
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    marginTop: authSpacing.xxl,
    padding: authSpacing.lg,
  },
  label: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    fontWeight: '800',
    marginBottom: authSpacing.sm,
  },
  input: {
    color: authColors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
    marginBottom: authSpacing.xl,
  },
  floatingCta: {
    bottom: 24,
    left: authSpacing.xl,
    position: 'absolute',
    right: authSpacing.xl,
  },
});
