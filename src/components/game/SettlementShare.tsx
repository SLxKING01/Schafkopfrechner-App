import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  captureSettlementImage,
  releaseSettlementImage,
  shareSettlementImage,
} from '../../services/game/settlementImage';
import { authColors } from '../../theme/colors';
import { authControlSizes, authSpacing } from '../../theme/spacing';
import type {
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../../types/game';
import {
  createSettlementExport,
  type SettlementExport,
  settlementExportDescription,
} from '../../utils/settlementExport';
import { GoldButton } from '../auth/GoldButton';
import { AppText } from '../ui/AppText';
import {
  SETTLEMENT_IMAGE_WIDTH,
  SettlementExportCard,
} from './SettlementExportCard';

type Props = {
  table: GameTable;
  players: Player[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  completedAt: string | null;
};

export function SettlementShare(props: Props) {
  const [snapshot, setSnapshot] = useState<{
    source: string;
    data: SettlementExport;
  } | null>(null);
  const [error, setError] = useState('');
  const source = JSON.stringify(props);
  if (props.table.isActive) return null;
  function open() {
    setError('');
    try {
      setSnapshot({
        source,
        data: createSettlementExport(
          props.table,
          props.players,
          props.balances,
          props.settlements,
          props.completedAt,
        ),
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Die Vorschau konnte nicht erstellt werden. Bitte erneut versuchen.',
      );
    }
  }
  return (
    <View style={styles.stack}>
      <GoldButton title="Abrechnung teilen" onPress={open} />
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
      {snapshot && snapshot.source !== source ? (
        <AppText accessibilityRole="alert">
          Die Abrechnung hat sich geändert. Bitte die Vorschau neu öffnen.
        </AppText>
      ) : null}
      {snapshot?.source === source ? (
        <ExportPreview data={snapshot.data} onClose={() => setSnapshot(null)} />
      ) : null}
    </View>
  );
}

function ExportPreview({
  data,
  onClose,
}: {
  data: SettlementExport;
  onClose: () => void;
}) {
  const target = useRef<ComponentRef<typeof View>>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [uri, setUri] = useState<string | null>(null);
  const [building, setBuilding] = useState(true);
  const [sharing, setSharing] = useState(false);
  const shareLock = useRef(false);
  const alive = useRef(true);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!size) return;
    let canceled = false;
    let captured: string | undefined;
    async function generate() {
      try {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        if (canceled) return;
        captured = await captureSettlementImage(target, size!);
        if (canceled) {
          void releaseSettlementImage(captured).catch(() => {});
          captured = undefined;
        } else setUri(captured);
      } catch {
        if (!canceled)
          setError(
            'Das Bild konnte nicht erstellt werden. Bitte erneut versuchen.',
          );
      } finally {
        if (!canceled) setBuilding(false);
      }
    }
    void generate();
    return () => {
      canceled = true;
      if (captured) void releaseSettlementImage(captured).catch(() => {});
    };
  }, [size, attempt]);

  async function share() {
    if (!uri || shareLock.current) return;
    shareLock.current = true;
    setSharing(true);
    setError('');
    try {
      await shareSettlementImage(uri);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Das Bild konnte nicht geteilt werden. Bitte erneut versuchen.',
        );
    } finally {
      shareLock.current = false;
      if (alive.current) setSharing(false);
    }
  }

  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={() => {
        if (!shareLock.current) onClose();
      }}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.preview}>
          <AppText accessibilityRole="header" variant="subtitle">
            Abrechnung teilen
          </AppText>
          <AppText style={styles.note}>
            Prüfe das vollständige Bild. Du wählst anschließend selbst, mit wem
            du es teilst.
          </AppText>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.previewContent}
            removeClippedSubviews={false}
          >
            {uri && size ? (
              <Image
                source={{ uri }}
                accessibilityLabel={settlementExportDescription(data)}
                style={{ width: '100%', aspectRatio: size.width / size.height }}
                resizeMode="contain"
              />
            ) : (
              <View
                ref={target}
                testID="settlement-export-content"
                style={{ width: SETTLEMENT_IMAGE_WIDTH }}
                collapsable={false}
                onLayout={({ nativeEvent: { layout } }) => {
                  if (layout.width > 0 && layout.height > 0)
                    setSize((old) =>
                      old?.width === layout.width &&
                      old.height === layout.height
                        ? old
                        : { width: layout.width, height: layout.height },
                    );
                }}
              >
                <SettlementExportCard data={data} />
              </View>
            )}
          </ScrollView>
          <View style={styles.stack} accessibilityLiveRegion="polite">
            {building ? (
              <AppText style={styles.note}>Bild wird erstellt …</AppText>
            ) : null}
            {error ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            {!uri && !building ? (
              <GoldButton
                title="Bild erneut erstellen"
                onPress={() => {
                  setBuilding(true);
                  setError('');
                  setAttempt((n) => n + 1);
                }}
              />
            ) : (
              <GoldButton
                title={
                  Platform.OS === 'web' ? 'Bild herunterladen' : 'Bild teilen'
                }
                disabled={!uri || building || sharing}
                loading={building || sharing}
                onPress={share}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vorschau schließen"
              disabled={sharing}
              onPress={onClose}
              style={styles.close}
            >
              <AppText>Schließen</AppText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: authColors.background },
  stack: { gap: authSpacing.sm },
  preview: {
    flex: 1,
    backgroundColor: authColors.background,
    padding: authSpacing.lg,
    gap: authSpacing.md,
  },
  scroll: { flex: 1, minHeight: 0 },
  previewContent: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingBottom: authSpacing.md,
  },
  note: { color: authColors.textSecondary, fontSize: 13, lineHeight: 19 },
  error: { color: authColors.errorText },
  close: {
    minHeight: authControlSizes.touch,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
