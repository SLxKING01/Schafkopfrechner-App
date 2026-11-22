import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { authSpacing } from '../../theme';
import type { StatisticsRound, StatisticsTable } from '../../utils/statistics';
import { PlayerStatistics } from './PlayerStatistics';
import {
  StatAction,
  StatHeading,
  StatPanel,
  TableStatisticsPanel,
} from './StatisticsPanels';

export function TableStatisticsView({
  table,
  onOpen,
}: {
  table: StatisticsTable;
  onOpen: (round: StatisticsRound) => void;
}) {
  const [playerId, setPlayerId] = useState<string>();
  const player = table.players.find(({ id }) => id === playerId);
  const entries = useMemo(
    () =>
      playerId
        ? table.rounds
            .filter((round) => round.participants.includes(playerId))
            .map((round) => ({ round, playerId }))
        : [],
    [playerId, table.rounds],
  );

  return (
    <>
      {table.rounds.length > 0 ? (
        <StatPanel>
          <StatHeading>Auswertung für diesen Tisch</StatHeading>
          <View style={styles.options}>
            <StatAction
              selected={!player}
              onPress={() => setPlayerId(undefined)}
            >
              Alle am Tisch
            </StatAction>
            {table.players.map(({ id, name }) => (
              <StatAction
                key={id}
                label={`Statistik für ${name}`}
                selected={player?.id === id}
                onPress={() => setPlayerId(id)}
              >
                {name}
              </StatAction>
            ))}
          </View>
        </StatPanel>
      ) : null}
      {player ? (
        <>
          <StatHeading>
            {player.name} · {table.name}
          </StatHeading>
          <PlayerStatistics key={player.id} entries={entries} onOpen={onOpen} />
        </>
      ) : (
        <TableStatisticsPanel table={table} onOpen={onOpen} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
});
