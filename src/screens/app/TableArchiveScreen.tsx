import { ScrollView } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { AppCard } from '../../components/ui/AppCard';
import { AppText } from '../../components/ui/AppText';
import type { AppStackScreenProps } from '../../navigation/types';
import { useGameStore } from '../../store/gameStore';
import { winningIds } from '../../utils/winningParty';

export function TableArchiveScreen({
  navigation,
}: AppStackScreenProps<'TableArchive'>) {
  const archive = useGameStore((state) => state.archivedTables);
  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 120 }}
      >
        <AppText variant="title">Tischarchiv</AppText>
        {archive.length === 0 ? (
          <AppText>Noch keine archivierten Tische.</AppText>
        ) : (
          [...archive].reverse().map((entry) => (
            <AppCard key={entry.currentTable.id}>
              <AppText variant="subtitle">{entry.currentTable.name}</AppText>
              <AppText>
                {new Date(entry.archivedAt).toLocaleString('de-DE')} ·{' '}
                {entry.rounds.length} Runden
              </AppText>
              {entry.balances.map((balance) => (
                <AppText key={balance.playerId}>
                  {entry.players.find((p) => p.id === balance.playerId)?.name ??
                    'Entfernter Spieler'}
                  : {balance.amount.toFixed(2)} €
                </AppText>
              ))}
              {entry.rounds.map((round) => (
                <AppText key={round.id}>
                  {round.gameType}:{' '}
                  {winningIds(round)
                    .map(
                      (id) =>
                        entry.players.find((p) => p.id === id)?.name ??
                        'Entfernter Spieler',
                    )
                    .join(' & ')}{' '}
                  · {round.amount.toFixed(2)} €
                </AppText>
              ))}
              <GoldButton
                title="Abrechnung ansehen"
                onPress={() =>
                  navigation.navigate('Settlement', {
                    tableId: entry.currentTable.id,
                  })
                }
              />
            </AppCard>
          ))
        )}
      </ScrollView>
    </AuthBackground>
  );
}
