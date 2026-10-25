import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStorageStatus } from '../storage/durableGameStorage';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';

export function StorageNotice() {
  const error = useStorageStatus((state) => state.error);
  if (!error) return null;
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <Text style={styles.text}>{error}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const state = useGameStore.getState();
          void (state.hydrated
            ? state.persistGame()
            : Promise.all([
                usePlayerStore.persist.rehydrate(),
                useMatchDayStore.persist.rehydrate(),
                state.hydrateGame(),
              ]));
        }}
        style={styles.button}
      >
        <Text>Erneut lokal speichern</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { padding: 12, backgroundColor: '#fff0cf' },
  text: { color: '#482400', fontSize: 16 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#fff',
  },
});
