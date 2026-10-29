import type { CardSuit, GameRound } from '../types/game';
import {
  calculateRoundBalances,
  isStockBooking,
  roundWinnerIds,
  toSafeCents,
} from './accounting';
import type { OverviewTarget } from './gameOverview';

export type StatisticsSourceRound = {
  id: string;
  winnerId: string;
  winnerIds?: string[];
  loserIds: string[];
  amount: number;
  createdAt: string;
  gameType?: string;
  gameTypeId?: string;
  suit?: CardSuit;
  declarerId?: string;
  partnerId?: string;
  tariffOptions?: GameRound['tariffOptions'];
  stockAction?: GameRound['stockAction'];
};
export type StatisticsRound = StatisticsSourceRound & {
  key: string;
  tableKey: string;
  type: string;
  cents: number;
  deltas: Record<string, number>;
  winners: string[];
  participants: string[];
};
export type StatisticsTable = {
  id: string;
  name: string;
  target: OverviewTarget;
  players: { id: string; name: string; userId?: string }[];
  rounds: StatisticsRound[];
  stockBookings: number;
};
function statisticsDeclarer(r: StatisticsSourceRound) {
  if (r.declarerId) return r.declarerId;
  // Solo-family rounds store the singleton party, rather than a separate declarer.
  if (
    !['solo', 'wenz', 'farbwenz', 'geier', 'farbgeier', 'bettel'].includes(
      r.gameType ?? r.gameTypeId ?? '',
    )
  )
    return undefined;
  const winners = roundWinnerIds(r);
  if (winners.length === 1 && r.loserIds.length === 3) return winners[0];
  if (winners.length === 3 && r.loserIds.length === 1) return r.loserIds[0];
  return undefined;
}
export function createStatisticsTable(
  id: string,
  name: string,
  players: StatisticsTable['players'],
  source: StatisticsSourceRound[],
  target: OverviewTarget,
  order: 'id' | 'input',
): StatisticsTable {
  return {
    id,
    name,
    players,
    target,
    stockBookings: source.filter(isStockBooking).length,
    rounds: source
      .filter((r) => !isStockBooking(r))
      .map((r) => ({
        ...r,
        declarerId: statisticsDeclarer(r),
        key: `${id}:${r.id}`,
        tableKey: id,
        type:
          (r.gameType ?? r.gameTypeId ?? 'sauspiel') === 'sauspiel'
            ? 'rufspiel'
            : (r.gameType ?? r.gameTypeId ?? 'rufspiel'),
        cents: toSafeCents(r.amount)!,
        winners: roundWinnerIds(r),
        participants: [...roundWinnerIds(r), ...r.loserIds],
        // Strip payout metadata: the stock is not a played win or loss.
        deltas: Object.fromEntries(
          calculateRoundBalances(
            players,
            [{ ...r, stockAction: undefined }],
            order,
          ).map((b) => [b.playerId, toSafeCents(b.amount)!]),
        ),
      })),
  };
}
export type StatisticsSubject = {
  id: string;
  name: string;
  context: string;
  memberships: { tableId: string; playerId: string }[];
};
export function statisticsSubjects(
  tables: StatisticsTable[],
): StatisticsSubject[] {
  const map = new Map<string, StatisticsSubject>();
  for (const table of tables)
    for (const player of table.players) {
      if (!table.rounds.some((r) => r.participants.includes(player.id)))
        continue;
      const id = player.userId
        ? `user:${player.userId}`
        : `${table.id}:${player.id}`;
      let subject = map.get(id);
      if (!subject) {
        subject = {
          id,
          name: player.name,
          context: table.name,
          memberships: [],
        };
        map.set(id, subject);
      }
      subject.memberships.push({ tableId: table.id, playerId: player.id });
      if (subject.memberships.length > 1)
        subject.context = `${subject.memberships.length} Tische`;
    }
  return [...map.values()];
}
export type StatisticsEntry = { round: StatisticsRound; playerId?: string };
export function subjectEntries(
  tables: StatisticsTable[],
  subject?: StatisticsSubject,
): StatisticsEntry[] {
  return tables.flatMap((table) => {
    const member = subject?.memberships.find((m) => m.tableId === table.id);
    if (subject && !member) return [];
    return table.rounds
      .filter((r) => !member || r.participants.includes(member.playerId))
      .map((round) => ({ round, playerId: member?.playerId }));
  });
}
export type StatisticsSummary = {
  count: number;
  wins: number;
  knownResults: number;
  balance: number;
  value: number;
  own: number;
  ownWins: number;
  knownDeclarers: number;
  bonusKnown: number;
  leger: number;
  kontra: number;
  re: number;
  best: number | null;
  worst: number | null;
};
export function summarizeStatistics(
  entries: StatisticsEntry[],
): StatisticsSummary {
  const out: StatisticsSummary = {
    count: entries.length,
    wins: 0,
    knownResults: 0,
    balance: 0,
    value: 0,
    own: 0,
    ownWins: 0,
    knownDeclarers: 0,
    bonusKnown: 0,
    leger: 0,
    kontra: 0,
    re: 0,
    best: null,
    worst: null,
  };
  for (const { round: r, playerId } of entries) {
    out.value += r.cents;
    if (r.declarerId) out.knownDeclarers++;
    const actor = playerId ?? r.declarerId;
    if (actor) {
      out.knownResults++;
      if (r.winners.includes(actor)) out.wins++;
    }
    if (playerId) {
      const cents = r.deltas[playerId] ?? 0;
      out.balance += cents;
      out.best = Math.max(out.best ?? cents, cents);
      out.worst = Math.min(out.worst ?? cents, cents);
      if (r.declarerId === playerId) {
        out.own++;
        if (r.winners.includes(playerId)) out.ownWins++;
      }
    }
    if (r.tariffOptions) {
      out.bonusKnown++;
      if (r.tariffOptions.legerCount > 0) out.leger++;
      if (r.tariffOptions.stoss > 0) out.kontra++;
      if (r.tariffOptions.stoss > 1) out.re++;
    }
  }
  return out;
}
export function groupStatistics(
  entries: StatisticsEntry[],
  key: (r: StatisticsRound, playerId?: string) => string,
) {
  const map = new Map<string, StatisticsEntry[]>();
  for (const entry of entries) {
    const id = key(entry.round, entry.playerId);
    const group = map.get(id);
    if (group) group.push(entry);
    else map.set(id, [entry]);
  }
  return [...map]
    .map(([id, items]) => ({
      id,
      entries: items,
      summary: summarizeStatistics(items),
    }))
    .sort(
      (a, b) => b.summary.count - a.summary.count || a.id.localeCompare(b.id),
    );
}
export function tableTrend(table: StatisticsTable) {
  const balances = Object.fromEntries(table.players.map((p) => [p.id, 0]));
  const highs = { ...balances },
    lows = { ...balances };
  let previousLeader: string | null = null,
    leadChanges = 0;
  const points = [
    {
      round: 0,
      balances: { ...balances },
      source: null as StatisticsRound | null,
    },
  ];
  for (const r of table.rounds) {
    for (const p of table.players) {
      balances[p.id] += r.deltas[p.id] ?? 0;
      highs[p.id] = Math.max(highs[p.id], balances[p.id]);
      lows[p.id] = Math.min(lows[p.id], balances[p.id]);
    }
    const best = Math.max(...Object.values(balances));
    const leaders = table.players.filter((p) => balances[p.id] === best);
    // Ties are not leadership changes; count only a different sole leader.
    if (leaders.length === 1) {
      if (previousLeader && previousLeader !== leaders[0].id) leadChanges++;
      previousLeader = leaders[0].id;
    }
    points.push({ round: points.length, balances: { ...balances }, source: r });
  }
  return { points, balances, highs, lows, leadChanges };
}
export function sauspielTeams(table: StatisticsTable) {
  const eligible = table.rounds.filter((r) => r.type === 'rufspiel');
  const known = eligible.filter(
    (r) =>
      r.declarerId &&
      r.partnerId &&
      r.declarerId !== r.partnerId &&
      table.players.some((p) => p.id === r.declarerId) &&
      table.players.some((p) => p.id === r.partnerId),
  );
  return {
    total: eligible.length,
    known: known.length,
    teams: groupStatistics(
      known.map((round) => ({ round })),
      (r) => JSON.stringify([r.declarerId!, r.partnerId!].sort()),
    ).map((g) => {
      const ids = JSON.parse(g.id) as string[];
      return {
        ...g,
        ids,
        wins: g.entries.filter(({ round: r }) =>
          ids.every((id) => r.winners.includes(id)),
        ).length,
        balance: g.entries.reduce(
          (sum, { round: r }) =>
            sum + ids.reduce((a, id) => a + (r.deltas[id] ?? 0), 0),
          0,
        ),
      };
    }),
  };
}
