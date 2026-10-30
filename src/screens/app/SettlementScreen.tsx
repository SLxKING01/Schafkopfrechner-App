import { Handshake } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { ScoreCard } from '../../components/game/ScoreCard';
import { SettlementCard } from '../../components/game/SettlementCard';
import { AppText } from '../../components/ui/AppText';
import type { AppStackScreenProps } from '../../navigation/types';
import { useStorageStatus } from '../../storage/durableGameStorage';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';

type SettlementScreenProps = AppStackScreenProps<'Settlement'>;

function formatAmount(amount: number) {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export function SettlementScreen({ navigation, route }: SettlementScreenProps) {
  const saving = useStorageStatus((state) => state.busy);
  const activeGame = useGameStore((state) => state.activeGame);
  const archived = useGameStore((state) =>
    state.archivedTables.find(
      (entry) => entry.currentTable.id === route.params?.tableId,
    ),
  );
  const isMissingArchive = Boolean(route.params?.tableId && !archived);
  const currentPlayers = useGameStore((state) => state.players);
  const players = archived?.players ?? currentPlayers;
  const currentSettlements = useGameStore((state) => state.settlements);
  const settlements = archived?.settlements ?? currentSettlements;
  const markSettlementPaid = useGameStore((state) => state.markSettlementPaid);
  const resetGame = useGameStore((state) => state.resetGame);
  const total = useMemo(
    () => settlements.reduce((sum, settlement) => sum + settlement.amount, 0),
    [settlements],
  );
  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );

  const getPlayerName = useCallback(
    (id: string) =>
      playerNameById.get(id) ?? `Name unbekannt (${id.slice(0, 8)})`,
    [playerNameById],
  );

  async function startNewTable() {
    if (!(await resetGame())) return;
    navigation.replace('CreateTable');
  }

  if (isMissingArchive)
    return (
      <AuthBackground>
        <AppText>
          Archivierter Tisch nicht gefunden. Der aktuelle Tisch bleibt
          unveraendert.
        </AppText>
      </AuthBackground>
    );
  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>Abrechnung</AppText>
        <AppText style={styles.title}>
          {archived ? archived.currentTable.name : 'Abrechnung des Tisches'}
        </AppText>
        <AppText style={styles.subtitle}>
          {!archived && activeGame
            ? 'Vorläufige Abrechnung. Schließe den Spieltag ab, bevor du Zahlungen als bezahlt markierst.'
            : 'Zahlungen zum Ausgleich aller Salden.'}
        </AppText>

        <View style={styles.scoreRow}>
          <ScoreCard label="Zahlungen" value={`${settlements.length}`} />
          <ScoreCard label="Gesamt" value={formatAmount(total)} />
        </View>

        <View style={styles.stack}>
          {settlements.length === 0 ? (
            <EmptyGameState
              icon={Handshake}
              title="Nichts offen"
              message="Alle Spieler sind bereits ausgeglichen."
            />
          ) : (
            settlements.map((settlement) => (
              <SettlementCard
                key={settlement.id}
                amount={formatAmount(settlement.amount)}
                from={getPlayerName(settlement.fromPlayerId)}
                isPaid={settlement.isPaid}
                to={getPlayerName(settlement.toPlayerId)}
                onMarkPaid={
                  archived || !activeGame
                    ? () =>
                        markSettlementPaid(
                          settlement.id,
                          archived?.currentTable.id,
                        )
                    : undefined
                }
              />
            ))
          )}
        </View>

        {archived ? (
          <AppText>Archivierte Abrechnung</AppText>
        ) : (
          <GoldButton
            title="Neuen Tisch starten"
            disabled={saving}
            onPress={startNewTable}
          />
        )}
        <GoldButton
          title="Tischarchiv öffnen"
          onPress={() => navigation.navigate('TableArchive')}
        />
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: authSpacing.xl,
    paddingBottom: 120,
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
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.body,
    lineHeight: 23,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: authSpacing.md,
  },
  stack: {
    gap: authSpacing.md,
  },
});
