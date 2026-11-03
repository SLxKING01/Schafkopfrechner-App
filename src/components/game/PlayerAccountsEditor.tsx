import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { setSharedTableRole } from '../../services/shared/sharedTables';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authInteraction, authRadius } from '../../theme/spacing';
import { tableAccess } from '../../utils/tableAccess';
import { AppText } from '../ui/AppText';

export function PlayerAccountsEditor() {
  const players = useGameStore((state) => state.players);
  const table = useGameStore((state) => state.currentTable);
  const userId = useAuthStore((state) => state.user?.id);
  const [savingRole, setSavingRole] = useState(false);
  const roleLock = useRef(false);
  const [roleError, setRoleError] = useState('');
  const canEdit = tableAccess(table, userId).canManage;
  return (
    <View style={styles.content}>
      <AppText variant="subtitle">Spielerkonten am Tisch</AppText>
      <AppText style={styles.hint}>
        Neue Konten erhalten Zugriff erst nach Annahme einer Tischeinladung.
        Bestehende Zuordnungen bleiben erhalten. Schreiben erlaubt
        Spieleingaben, Korrekturen, Löschen und Wiederherstellen. Regeln,
        Spieler und Tischabschluss verwaltet nur der Ersteller.
      </AppText>
      {roleError ? (
        <AppText accessibilityRole="alert" style={styles.hint}>
          {roleError}
        </AppText>
      ) : null}
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
          {table?.shared &&
          player.userId &&
          player.userId !== table.shared.ownerId ? (
            <View>
              <AppText style={styles.hint}>
                {table.shared.members?.find((m) => m.userId === player.userId)
                  ?.role === 'write'
                  ? 'Schreiben'
                  : 'Lesen'}
              </AppText>
              {canEdit ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['read', 'write'] as const).map((role) => (
                    <Pressable
                      key={role}
                      accessibilityRole="button"
                      accessibilityLabel={`${player.name}: ${role === 'write' ? 'Schreiben' : 'Lesen'} erlauben`}
                      accessibilityState={{
                        selected:
                          (table.shared?.members?.find(
                            (m) => m.userId === player.userId,
                          )?.role ?? 'read') === role,
                        disabled: savingRole,
                      }}
                      disabled={savingRole}
                      style={({ pressed }) => [
                        styles.button,
                        styles.roleButton,
                        (table.shared?.members?.find(
                          (m) => m.userId === player.userId,
                        )?.role ?? 'read') === role && styles.selectedRole,
                        pressed && authInteraction.pressed,
                        savingRole && authInteraction.disabled,
                      ]}
                      onPress={() => {
                        if (roleLock.current) return;
                        roleLock.current = true;
                        setSavingRole(true);
                        setRoleError('');
                        void setSharedTableRole(player.userId!, role)
                          .catch((error: Error) => setRoleError(error.message))
                          .finally(() => {
                            roleLock.current = false;
                            setSavingRole(false);
                          });
                      }}
                    >
                      <AppText style={styles.link}>
                        {role === 'write' ? 'Schreiben' : 'Lesen'}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {canEdit &&
          !player.userId &&
          !players.some((p) => p.userId === userId) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eigenes Konto mit ${player.name} verknüpfen`}
              onPress={() =>
                useGameStore.getState().setPlayerAccount(player.id, userId)
              }
              style={styles.button}
            >
              <AppText style={styles.link}>Eigenes Konto verknüpfen</AppText>
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
  roleButton: {
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.sm,
  },
  selectedRole: {
    borderColor: authColors.gold,
    backgroundColor: authColors.control,
  },
  link: { color: authColors.gold, fontSize: 13 },
});
