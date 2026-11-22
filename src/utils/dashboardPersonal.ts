import {
  type StatisticsEntry,
  type StatisticsTable,
  summarizeStatistics,
} from './statistics';

export function dashboardPersonal(tables: StatisticsTable[], userId?: string) {
  const memberships = new Map<string, string>();
  for (const table of tables) {
    // Signed in: the seat linked to the account. Guest: the seat that was
    // marked as the guest's own when the table was created.
    const linked = userId
      ? table.players.filter((p) => p.userId === userId)
      : table.players.filter((p) => p.guestSelf);
    if (linked.length === 1) memberships.set(table.id, linked[0].id);
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
    entries,
    summary: summarizeStatistics(entries),
    memberships,
    hasIdentity: memberships.size > 0,
    unassigned: tables.filter(
      (t) => t.rounds.length > 0 && !memberships.has(t.id),
    ).length,
  };
}
