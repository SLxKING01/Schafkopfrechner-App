import { gameRuleDefinitions } from '../constants/tableSettings';
import type { Game } from '../models/Game';
import type { MatchDay } from '../models/MatchDay';
import type { Player as SavedPlayer } from '../models/Player';
import type {
  ArchivedGameDay,
  GameRound,
  GameTable,
  Player,
  PlayerBalance,
  Settlement,
} from '../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
  isStockBooking,
  roundWinnerIds,
  toSafeCents,
} from './accounting';
import { formatRoundGameType } from './cardSuits';
import {
  createStatisticsTable,
  type StatisticsSourceRound,
  type StatisticsTable,
} from './statistics';

type OverviewInput = {
  currentTable: GameTable | null;
  players: Player[];
  rounds: GameRound[];
  balances: PlayerBalance[];
  settlements: Settlement[];
  activeGame: boolean;
  archivedGameDays: ArchivedGameDay[];
  games: Game[];
  savedPlayers: SavedPlayer[];
  matchDays: MatchDay[];
  activeMatchDayId: string | null;
};
export type OverviewTarget =
  | { kind: 'active' }
  | { kind: 'archive'; tableId: string }
  | { kind: 'legacy'; matchDayId: string };
export type OverviewRound = {
  id: string;
  tableName: string;
  gameType: string;
  createdAt: string;
  amountCents: number;
  winnerName: string;
  participants: number;
  target: OverviewTarget;
};
export type OverviewPayment = {
  id: string;
  tableName: string;
  from: string;
  to: string;
  amountCents: number;
  target: OverviewTarget;
};
export type OverviewPlayer = {
  id: string;
  name: string;
  tableName: string;
  rounds: number;
  wins: number;
  losses: number;
  balanceCents: number;
  target: OverviewTarget;
};
const dateTime = (date: string) => {
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const localDay = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
export function formatOverviewMoney(cents: number | bigint) {
  const value = BigInt(cents);
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${(absolute / 100n).toLocaleString('de-DE')},${String(absolute % 100n).padStart(2, '0')} €`;
}
export function overviewGameType(id: string) {
  return (
    gameRuleDefinitions.find((rule) => rule.id === id)?.label ??
    (id === 'sauspiel' ? 'Sauspiel' : 'Freies Spiel')
  );
}

/** Archived copies are authoritative for finished tables; never count the current copy twice. */
export function buildGameOverview(input: OverviewInput, now = new Date()) {
  const rounds: OverviewRound[] = [];
  const payments: OverviewPayment[] = [];
  const playerStats: OverviewPlayer[] = [];
  const statisticsTables: StatisticsTable[] = [];
  const days = new Map<
    string,
    {
      table: GameTable;
      players: Player[];
      rounds: GameRound[];
      settlements: Settlement[];
    }
  >();
  if (input.currentTable)
    days.set(input.currentTable.id, {
      table: input.currentTable,
      players: input.players,
      rounds: input.rounds,
      settlements: input.settlements,
    });
  for (const day of input.archivedGameDays) days.set(day.table.id, day);
  function addRounds(
    key: string,
    tableName: string,
    roster: { id: string; name: string; userId?: string }[],
    source: StatisticsSourceRound[],
    target: OverviewTarget,
    order: 'id' | 'input',
  ) {
    statisticsTables.push(
      createStatisticsTable(key, tableName, roster, source, target, order),
    );
    const names = new Map(roster.map((player) => [player.id, player.name]));
    const balances = calculateRoundBalances(roster, source, order);
    for (const [index, round] of source.entries()) {
      if (isStockBooking(round)) continue;
      rounds.push({
        id: `${key}:${round.id}`,
        tableName,
        gameType: formatRoundGameType(
          round.gameType ?? round.gameTypeId ?? 'sauspiel',
          round.suit,
        ),
        createdAt: round.createdAt,
        amountCents:
          toSafeCents(round.amount)! +
          (round.stockAction === 'payout'
            ? getStockBalanceCents(source.slice(0, index))
            : 0),
        winnerName:
          round.stockAction === 'deposit'
            ? 'Stock'
            : roundWinnerIds(round)
                .map((id) => names.get(id) ?? 'Unbekannt')
                .join(' & '),
        participants: roundWinnerIds(round).length + round.loserIds.length,
        target,
      });
    }
    for (const player of roster) {
      const wins = source.filter((round) =>
        roundWinnerIds(round).includes(player.id),
      ).length;
      const losses = source.filter(
        (round) => !isStockBooking(round) && round.loserIds.includes(player.id),
      ).length;
      if (wins + losses === 0) continue;
      playerStats.push({
        id: `${key}:${player.id}`,
        name: player.name,
        tableName,
        rounds: wins + losses,
        wins,
        losses,
        balanceCents: toSafeCents(
          balances.find((balance) => balance.playerId === player.id)!.amount,
        )!,
        target,
      });
    }
  }
  let completedTables = 0;
  let activeTarget: OverviewTarget | null = null;
  for (const [id, day] of days) {
    const active =
      day.table.isActive && input.activeGame && input.currentTable?.id === id;
    const target: OverviewTarget = active
      ? { kind: 'active' }
      : { kind: 'archive', tableId: id };
    if (active) activeTarget = target;
    else completedTables++;
    addRounds(
      `table:${id}`,
      day.table.name,
      day.players,
      day.rounds,
      target,
      'id',
    );
    // During play these are provisional balances, not finalized payment requests.
    if (active) continue;
    const names = new Map(
      day.players.map((player) => [player.id, player.name]),
    );
    for (const payment of day.settlements.filter((payment) => !payment.isPaid))
      payments.push({
        id: `${id}:${payment.id}`,
        tableName: day.table.name,
        from: names.get(payment.fromPlayerId) ?? 'Unbekannt',
        to: names.get(payment.toPlayerId) ?? 'Unbekannt',
        amountCents: toSafeCents(payment.amount)!,
        target,
      });
  }
  // Older offline games remain visible; they have no stored paid/unpaid payment status.
  for (const day of input.matchDays) {
    const games = input.games.filter(
      (game) => (game.matchDayId ?? input.activeMatchDayId) === day.id,
    );
    if (!games.length) continue;
    addRounds(
      `legacy:${day.id}`,
      day.name,
      input.savedPlayers,
      games,
      { kind: 'legacy', matchDayId: day.id },
      'input',
    );
  }
  rounds.sort(
    (a, b) =>
      dateTime(b.createdAt) - dateTime(a.createdAt) || a.id.localeCompare(b.id),
  );
  const today = rounds.filter(
    (round) => localDay(new Date(round.createdAt)) === localDay(now),
  );
  const typeCounts = new Map<string, number>();
  for (const round of rounds)
    typeCounts.set(round.gameType, (typeCounts.get(round.gameType) ?? 0) + 1);
  const favoriteType =
    [...typeCounts].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? '–';
  return {
    asOf: now.getTime(),
    statisticsTables,
    rounds,
    payments,
    playerStats,
    completedTables,
    activeTarget,
    activeTable: activeTarget ? input.currentTable : null,
    todayRounds: today.length,
    roundValueCents: rounds.reduce(
      (sum, round) => sum + BigInt(round.amountCents),
      0n,
    ),
    openPaymentCents: payments.reduce(
      (sum, payment) => sum + BigInt(payment.amountCents),
      0n,
    ),
    favoriteType,
  };
}
