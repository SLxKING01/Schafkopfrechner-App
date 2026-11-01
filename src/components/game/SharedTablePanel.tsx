import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  loadSharedTableAfterConflict,
  syncSharedTable,
  useSharedTableStatus,
} from '../../services/shared/sharedTables';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { AppText } from '../ui/AppText';

export function SharedTablePanel() {
  const table = useGameStore((state) => state.currentTable);
  const userId = useAuthStore((state) => state.user?.id);
  const { busy, error, conflict } = useSharedTableStatus();
  if (!table) return null;
  const meta = table.shared;
  const own = !meta || meta.userId === userId;
  return (
    <View style={styles.panel}>
      <AppText style={styles.text}>
        {meta
          ? 'Gemeinsamer Tisch'
          : 'Tisch wird für die eingetragenen Spielerkonten bereitgestellt.'}
      </AppText>
      {!meta ? (
        <>
          <AppText style={styles.text}>
            Spielerkonten unter „Regeln & Tarife“ zuordnen. Der Tisch wird
            automatisch übertragen.
          </AppText>
          {error ? (
            <>
              <AppText accessibilityRole="alert" style={styles.text}>
                Noch nicht übertragen: {error}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void syncSharedTable();
                }}
                style={styles.action}
              >
                <AppText style={styles.link}>Erneut verbinden</AppText>
              </Pressable>
            </>
          ) : null}
        </>
      ) : own ? (
        <>
          <AppText style={styles.text}>
            {busy
              ? 'Stand wird abgeglichen …'
              : error
                ? `Noch nicht übertragen: ${error}`
                : `Letzter Abgleich: ${new Date(meta.updatedAt).toLocaleTimeString('de-DE')}`}
          </AppText>
          {error && !conflict ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void syncSharedTable();
              }}
              style={styles.action}
            >
              <AppText style={styles.link}>Erneut verbinden</AppText>
            </Pressable>
          ) : null}
          {conflict?.tableId === table.id ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aktuellen Tischstand laden"
              onPress={() =>
                Alert.alert(
                  'Aktuellen Tischstand laden?',
                  'Deine noch nicht übertragenen Änderungen werden auf diesem Handy gesichert. Danach wird der gemeinsame Stand geladen; du kannst deine Eingabe erneut eintragen.',
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    {
                      text: 'Stand laden',
                      onPress: () => {
                        void loadSharedTableAfterConflict().catch(
                          (reason: Error) =>
                            Alert.alert('Stand nicht geladen', reason.message),
                        );
                      },
                    },
                  ],
                )
              }
              style={styles.action}
            >
              <AppText style={styles.link}>Aktuellen Tischstand laden</AppText>
            </Pressable>
          ) : null}
        </>
      ) : (
        <AppText style={styles.text}>
          Bitte mit dem Konto anmelden, mit dem du diesem Tisch beigetreten
          bist.
        </AppText>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    padding: 12,
    gap: 4,
    borderColor: authColors.borderSoft,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 12,
  },
  text: { color: authColors.textSecondary, fontSize: 13 },
  link: { color: authColors.gold, fontWeight: '700' },
  action: { minHeight: 44, justifyContent: 'center' },
});

export function SharedTableConflictNotice() {
  const conflict = useSharedTableStatus((state) => state.conflict);
  const userId = useAuthStore((state) => state.user?.id);
  if (!conflict || conflict.userId !== userId) return null;
  return (
    <View style={styles.panel}>
      <AppText style={styles.text}>
        Am Tisch „{conflict.remote.payload.currentTable.name}“ gibt es
        gleichzeitige Änderungen. Deine Eingaben wurden noch nicht übertragen.
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gemeinsamen Stand nach Konflikt laden"
        style={styles.action}
        onPress={() =>
          Alert.alert(
            'Gemeinsamen Stand laden?',
            'Deine ausstehenden Änderungen werden auf diesem Handy gesichert. Danach wird der Stand der anderen Handys geladen.',
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Stand laden',
                onPress: () => {
                  void loadSharedTableAfterConflict().catch((reason: Error) =>
                    Alert.alert('Stand nicht geladen', reason.message),
                  );
                },
              },
            ],
          )
        }
      >
        <AppText style={styles.link}>Gemeinsamen Stand laden</AppText>
      </Pressable>
    </View>
  );
}
