import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { usePlayerAccounts } from '../../hooks/usePlayerAccounts';
import { authColors } from '../../theme/colors';
import type { FriendProfile } from '../../types/profile';
import { AppText } from '../ui/AppText';
import { InteractionSheet } from '../ui/InteractionSheet';

export function AccountPicker({
  visible,
  onClose,
  onSelect,
  excludedIds = [],
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (account: FriendProfile) => void;
  excludedIds?: string[];
}) {
  const [query, setQuery] = useState('');
  const { accounts, error } = usePlayerAccounts(query, visible);
  return (
    <InteractionSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <AppText variant="subtitle">Mitspieler mit Konto auswählen</AppText>
        <AppText style={styles.hint}>
          Nach dem Benutzernamen suchen. Eingetragene Konten sehen den Tisch
          automatisch.
        </AppText>
        <TextInput
          accessibilityLabel="Benutzerkonto suchen"
          placeholder="Benutzername (mindestens 2 Zeichen)"
          placeholderTextColor={authColors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
          style={styles.input}
        />
        {!!error && <AppText accessibilityRole="alert">{error}</AppText>}
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {accounts
            .filter((account) => !excludedIds.includes(account.id))
            .map((account) => (
              <Pressable
                key={account.id}
                accessibilityRole="button"
                accessibilityLabel={`${account.username} als Spielerkonto auswählen`}
                onPress={() => {
                  onSelect(account);
                  onClose();
                }}
                style={styles.row}
              >
                <AppText>{account.username}</AppText>
              </Pressable>
            ))}
          {query.trim().length >= 2 && !accounts.length && !error ? (
            <AppText style={styles.hint}>
              Noch keine passenden Konten gefunden.
            </AppText>
          ) : null}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kontosuche schließen"
          onPress={onClose}
          style={styles.row}
        >
          <AppText>Schließen</AppText>
        </Pressable>
      </View>
    </InteractionSheet>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, maxHeight: '100%' },
  hint: { color: authColors.textSecondary, fontSize: 13 },
  input: {
    color: authColors.textPrimary,
    borderColor: authColors.borderSoft,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    padding: 12,
  },
  list: { flexShrink: 1 },
  row: { paddingVertical: 16, minHeight: 48 },
});
