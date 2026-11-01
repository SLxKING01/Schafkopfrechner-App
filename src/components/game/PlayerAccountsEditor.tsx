import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { AppText } from '../ui/AppText';
import { AccountPicker } from './AccountPicker';

export function PlayerAccountsEditor() {
  const players = useGameStore((state) => state.players);
  const table = useGameStore((state) => state.currentTable);
  const userId = useAuthStore((state) => state.user?.id);
  const [selectedId, setSelectedId] = useState<string>();
  const canEdit = !table?.shared?.ownerId || table.shared.ownerId === userId;
  return (
    <View style={styles.content}>
      <AppText variant="subtitle">Spielerkonten am Tisch</AppText>
      <AppText style={styles.hint}>
        Verknüpfte Konten sehen diesen Tisch automatisch und erhalten
        Live-Eintragungen. Zuordnungen werden direkt gespeichert. Nur der
        Tischbesitzer kann sie ändern.
      </AppText>
      {players.map((player) => (
        <View key={player.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppText>{player.name}</AppText>
            <AppText style={styles.hint}>
              {player.userId
                ? 'Benutzerkonto verknüpft'
                : 'Gast · nur auf dem Tisch geführt'}
            </AppText>
          </View>
          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Konto für ${player.name} zuordnen`}
              onPress={() => setSelectedId(player.id)}
              style={styles.button}
            >
              <AppText style={styles.link}>
                {player.userId ? 'Ändern' : 'Konto zuordnen'}
              </AppText>
            </Pressable>
          ) : null}
          {canEdit && player.userId && player.userId !== userId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Kontozugriff für ${player.name} entfernen`}
              onPress={() =>
                Alert.alert(
                  'Kontozugriff entfernen?',
                  'Dieser Spieler bleibt in den bisherigen Spielen enthalten. Sein Konto kann den Tisch danach nicht mehr öffnen.',
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    {
                      text: 'Entfernen',
                      style: 'destructive',
                      onPress: () =>
                        useGameStore.getState().setPlayerAccount(player.id),
                    },
                  ],
                )
              }
              style={styles.button}
            >
              <AppText style={styles.link}>Entfernen</AppText>
            </Pressable>
          ) : null}
        </View>
      ))}
      <AccountPicker
        visible={!!selectedId}
        onClose={() => setSelectedId(undefined)}
        excludedIds={players
          .filter((player) => player.id !== selectedId)
          .flatMap((player) => (player.userId ? [player.userId] : []))}
        onSelect={(account) => {
          if (
            !selectedId ||
            !useGameStore.getState().setPlayerAccount(selectedId, account.id)
          )
            Alert.alert(
              'Zuordnung nicht gespeichert',
              'Dieses Konto ist bereits am Tisch oder der Tisch wurde inzwischen geschlossen.',
            );
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  content: { marginTop: 20, gap: 12 },
  hint: { fontSize: 12, color: authColors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderColor: authColors.borderSoft,
    paddingVertical: 8,
  },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  link: { color: authColors.gold, fontSize: 13 },
});
