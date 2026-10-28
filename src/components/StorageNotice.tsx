import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getStorageIssues,
  reliableStorage,
  subscribeStorageIssues,
} from '../storage/reliableStorage';

export function StorageNotice() {
  const issues = useSyncExternalStore(
    subscribeStorageIssues,
    getStorageIssues,
    getStorageIssues,
  );
  const insets = useSafeAreaInsets();
  if (!issues.length) return null;
  return (
    <View
      accessibilityLiveRegion="assertive"
      style={[styles.notice, { top: insets.top + 8 }]}
    >
      <Text style={styles.text}>{issues[0].message}</Text>
      {issues.some((issue) => issue.message.startsWith('Änderungen')) ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void reliableStorage.retryWrites();
          }}
          style={styles.button}
        >
          <Text style={styles.action}>Erneut speichern</Text>
        </Pressable>
      ) : null}
      {!issues[0].blocked ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => reliableStorage.acknowledgeRecovery(issues[0].key)}
          style={styles.button}
        >
          <Text style={styles.action}>Verstanden</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    backgroundColor: '#4b2816',
    borderColor: '#e8c85e',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  text: { color: '#fff', fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
  },
  action: { color: '#e8c85e', fontWeight: '700' },
});
