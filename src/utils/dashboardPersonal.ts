import {
  type StatisticsEntry,
  type StatisticsTable,
  summarizeStatistics,
} from './statistics';

export function dashboardPersonal(
  tables: StatisticsTable[],
  selections: Record<string, string>,
  userId?: string,
) {
  const memberships = new Map<string, string>();
  for (const table of tables) {
    const linked = userId
      ? table.players.filter((p) => p.userId === userId)
      : [];
    if (linked.length === 1) memberships.set(table.id, linked[0].id);
    else if (
      !linked.length &&
      table.players.some(
        (p) =>
          p.id === selections[table.id] && (!p.userId || p.userId === userId),
      )
    )
      memberships.set(table.id, selections[table.id]);
  }
  const entries: StatisticsEntry[] = tables.flatMap((table) => {
    const playerId = memberships.get(table.id);
    return playerId
      ? table.rounds
          .filter((r) => r.participants.includes(playerId))
          .map((round) => ({ round, playerId }))
      : [];
  });
  return {
    summary: summarizeStatistics(entries),
    memberships,
    hasIdentity: memberships.size > 0,
    unassigned: tables.filter(
      (t) => t.rounds.length > 0 && !memberships.has(t.id),
    ).length,
  };
}
