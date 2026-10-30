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
        <AppText variant="title" style={{ color: '#F5F5F5' }}>
          Tischarchiv
        </AppText>
        <AppText style={{ color: '#F5F5F5' }}>
          Lokal auf diesem Geraet - keine Cloud-Sicherung.
        </AppText>
        {archive.length === 0 ? (
          <AppText style={{ color: '#F5F5F5' }}>
            Noch keine archivierten Tische. Archive werden nur lokal auf diesem
            Geraet gespeichert.
          </AppText>
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
                    'Name unbekannt'}
                  : {balance.amount.toFixed(2).replace('.', ',')} €
                </AppText>
              ))}
              {entry.rounds.map((round) => (
                <AppText key={round.id}>
                  {round.gameType}:{' '}
                  {winningIds(round)
                    .map(
                      (id) =>
                        entry.players.find((p) => p.id === id)?.name ??
                        'Name unbekannt',
                    )
                    .join(' & ')}{' '}
                  · {round.amount.toFixed(2).replace('.', ',')} €
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
