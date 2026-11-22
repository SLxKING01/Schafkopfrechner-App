import type { StatisticsRound, StatisticsTable } from '../../utils/statistics';
import { TableStatisticsPanel } from './StatisticsPanels';

/**
 * Whole-table view. Personal values per player live under
 * "Statistik → Mein Spiel", so there is no player switch here.
 */
export function TableStatisticsView({
  table,
  onOpen,
}: {
  table: StatisticsTable;
  onOpen: (round: StatisticsRound) => void;
}) {
  return <TableStatisticsPanel table={table} onOpen={onOpen} />;
}
