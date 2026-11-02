import { validGameSnapshot } from '../../storage/validateGameState';
import type { GameRound, GameTable } from '../../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
} from '../../utils/accounting';
import { getNextDealerId } from '../../utils/dealerOrder';
import { outstandingBalances } from '../../utils/interimPayments';
import { replayStockRules } from '../../utils/stockRules';
import { finishGameDay } from '../game/finishGameDay';
import { fingerprint } from '../sync/syncGameState';
import type { SharedSnapshot } from './sharedTables';

function tableConfiguration(table: GameTable) {
  const { roundHistory, dealerId, placedLegerPlayerIds, ...configuration } =
    table;
  return configuration;
}

function roundInput(round: GameRound) {
  const { stockBeforeCents, stockAfterCents, stockAction, ...input } = round;
  // These Sauspiel movements depend on the preceding, server-accepted games.
  return ['rufspiel', 'sauspiel'].includes(round.gameType)
    ? input
    : { ...input, stockAction };
}

/** Only independent appends are merged. Corrections, deletion, payments, seat or
 * rule changes need explicit review rather than a last-writer-wins decision.
 * The accepted remote list comes first; device timestamps never sort games. */
export function mergeSharedRounds(
  baseline: SharedSnapshot,
  local: SharedSnapshot,
  remote: SharedSnapshot,
): SharedSnapshot | null {
  return mergeAppends(baseline, local, remote, false);
}

/** Rebase only edits made after the request started onto its accepted result.
 * That result can already contain other phones' rounds before our old prefix. */
export function rebaseInFlightRounds(
  sentLocal: SharedSnapshot,
  latestLocal: SharedSnapshot,
  accepted: SharedSnapshot,
): SharedSnapshot | null {
  return mergeAppends(sentLocal, latestLocal, accepted, true);
}

function mergeAppends(
  baseline: SharedSnapshot,
  local: SharedSnapshot,
  remote: SharedSnapshot,
  inFlight: boolean,
): SharedSnapshot | null {
  try {
    if (![baseline, local, remote].every(validGameSnapshot)) return null;
    const additions = (side: SharedSnapshot) => {
      if (
        !baseline.activeGame ||
        !side.activeGame ||
        fingerprint(side.players) !== fingerprint(baseline.players) ||
        fingerprint(tableConfiguration(side.currentTable)) !==
          fingerprint(tableConfiguration(baseline.currentTable)) ||
        side.rounds.length < baseline.rounds.length ||
        baseline.rounds.some(
          (r, i) => fingerprint(r) !== fingerprint(side.rounds[i]),
        )
      )
        return null;
      const added = side.rounds.slice(baseline.rounds.length);
      const before = baseline.currentTable.roundHistory ?? [];
      const history = side.currentTable.roundHistory ?? [];
      if (fingerprint(history.slice(0, before.length)) !== fingerprint(before))
        return null;
      const events = history.slice(before.length);
      if (
        events.length !== added.length ||
        events.some(
          (e, i) =>
            e.action !== 'created' ||
            e.roundId !== added[i].id ||
            fingerprint(e.after) !== fingerprint(added[i]),
        )
      )
        return null;
      // Do not swallow an explicit dealer/knocker change as a derived field.
      let expected = baseline.currentTable;
      for (const round of added) {
        expected = {
          ...expected,
          dealerId: round.roundContext?.completesDeal
            ? (getNextDealerId(expected, side.players, 0) ?? undefined)
            : expected.dealerId,
          placedLegerPlayerIds: round.roundContext?.completesDeal
            ? []
            : expected.placedLegerPlayerIds,
        };
      }
      if (
        fingerprint([
          side.currentTable.dealerId,
          side.currentTable.placedLegerPlayerIds,
        ]) !== fingerprint([expected.dealerId, expected.placedLegerPlayerIds])
      )
        return null;
      return { added, events };
    };
    const ours = additions(local);
    if (!ours || (!inFlight && !additions(remote))) return null;
    if (
      inFlight &&
      (!remote.activeGame ||
        fingerprint(remote.players) !== fingerprint(baseline.players) ||
        fingerprint(tableConfiguration(remote.currentTable)) !==
          fingerprint(tableConfiguration(baseline.currentTable)) ||
        baseline.rounds.some((r) => {
          const saved = remote.rounds.find(
            (candidate) => candidate.id === r.id,
          );
          return (
            !saved ||
            fingerprint(roundInput(saved)) !== fingerprint(roundInput(r))
          );
        }))
    )
      return null;
    const known = new Map(remote.rounds.map((r) => [r.id, r]));
    const pending: GameRound[] = [];
    const events = [...(remote.currentTable.roundHistory ?? [])];
    for (const [index, round] of ours.added.entries()) {
      const existing = known.get(round.id);
      if (existing) {
        const event = events.find(
          (e) => e.roundId === round.id && e.action === 'created',
        );
        if (
          fingerprint(roundInput(existing)) !==
            fingerprint(roundInput(round)) ||
          event?.id !== ours.events[index].id
        )
          return null;
      } else {
        pending.push(round);
        events.push({ ...ours.events[index], sequence: events.length + 1 });
      }
    }
    if (!pending.length) return remote;
    let table = { ...remote.currentTable };
    for (const round of pending) {
      if (round.roundContext?.completesDeal)
        table = {
          ...table,
          dealerId: getNextDealerId(table, remote.players, 0) ?? undefined,
          placedLegerPlayerIds: [],
        };
    }
    const rounds = replayStockRules([...remote.rounds, ...pending], table);
    const byId = new Map(rounds.map((r) => [r.id, r]));
    const pendingIds = new Set(pending.map((r) => r.id));
    table.roundHistory = events.map((e) =>
      pendingIds.has(e.roundId) ? { ...e, after: byId.get(e.roundId) } : e,
    );
    const balances = calculateRoundBalances(remote.players, rounds, 'id');
    const merged = {
      ...remote,
      currentTable: table,
      rounds,
      balances,
      settlements:
        getStockBalanceCents(rounds) > 0
          ? []
          : finishGameDay(outstandingBalances(balances, table.interimPayments)),
    };
    return validGameSnapshot(merged) ? merged : null;
  } catch {
    return null;
  }
}
