import { CloudOff, RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useStorageStatus } from '../../storage/durableGameStorage';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppText } from '../ui/AppText';

type SyncStatusBadgeProps = {
  syncing: boolean;
  isOffline: boolean;
  lastSyncedAt: string | null;
};

export function SyncStatusBadge({ syncing }: SyncStatusBadgeProps) {
  const error = useStorageStatus((state) => state.error);
  const savedAt = useStorageStatus((state) => state.lastSavedAt);
  const isOffline = true;
  const Icon = syncing ? RefreshCw : CloudOff;
  const label = error
    ? 'Lokales Speichern fehlgeschlagen'
    : savedAt
      ? 'Lokal gespeichert - keine Cloud-Sicherung'
      : 'Nur lokal - Cloud nicht eingerichtet';

  return (
    <View style={[styles.badge, isOffline && styles.offline]}>
      <Icon
        color={isOffline ? authColors.goldHighlight : authColors.accentGreen}
        size={14}
        strokeWidth={2.2}
      />
      <AppText style={styles.text}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    maxWidth: '100%',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(107, 163, 110, 0.12)',
    borderColor: 'rgba(107, 163, 110, 0.26)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.xs,
    marginTop: authSpacing.md,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  offline: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  text: {
    flexShrink: 1,
    color: authColors.textPrimary,
    fontSize: authTypography.tiny,
    fontWeight: '900',
  },
});
