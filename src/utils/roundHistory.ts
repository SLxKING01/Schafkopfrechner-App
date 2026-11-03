import * as crypto from 'expo-crypto';

import { normalizeTableSettings } from '../constants/tableSettings';
import type {
  GameRound,
  GameTable,
  Player,
  RoundHistoryActor,
  RoundHistoryEvent,
} from '../types/game';
import { roundWinnerIds, toSafeCents } from './accounting';
import { cardSuits, formatRoundGameType } from './cardSuits';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function roundHistoryFingerprint(round: GameRound) {
  return canonical({
    ...round,
    updatedAt: undefined,
    winnerId: undefined,
    winnerIds: [...roundWinnerIds(round)].sort(),
    loserIds: [...round.loserIds].sort(),
    participantIds: round.participantIds?.slice().sort(),
    customAmounts: round.customAmounts
      ?.slice()
      .sort((a, b) => a.playerId.localeCompare(b.playerId)),
    settingsSnapshot: normalizeTableSettings(round.settingsSnapshot),
  });
}

/** Append in the same store transaction as the successful financial change. */
export function appendRoundHistory(
  table: GameTable,
  before: GameRound[],
  after: GameRound[],
  players: Player[],
  actor: RoundHistoryActor,
  causeRoundId?: string,
  undoOfEventId?: string,
): GameTable {
  const history = [...(table.roundHistory ?? [])];
  const old = new Map(before.map((r) => [r.id, r]));
  const next = new Map(after.map((r) => [r.id, r]));
  const occurredAt = new Date().toISOString();
  for (const id of new Set([...old.keys(), ...next.keys()])) {
    const previous = old.get(id);
    const current = next.get(id);
    if (
      previous &&
      current &&
      roundHistoryFingerprint(previous) === roundHistoryFingerprint(current)
    )
      continue;
    const event: RoundHistoryEvent = {
      id: crypto.randomUUID(),
      roundId: id,
      sequence: history.length + 1,
      occurredAt,
      action: !previous
        ? history.some((e) => e.roundId === id && e.action === 'deleted')
          ? 'restored'
          : 'created'
        : !current
          ? 'deleted'
          : 'updated',
      actor,
      players: players.map((p) => ({ id: p.id, name: p.name })),
      ...(previous ? { before: previous } : {}),
      ...(current ? { after: current } : {}),
      ...(!current ? { roundOrderIds: before.map((r) => r.id) } : {}),
      ...(causeRoundId && causeRoundId !== id ? { causeRoundId } : {}),
      ...(undoOfEventId && causeRoundId === id ? { undoOfEventId } : {}),
    };
    history.push(JSON.parse(JSON.stringify(event)) as RoundHistoryEvent);
  }
  return history.length === (table.roundHistory?.length ?? 0)
    ? table
    : { ...table, roundHistory: history };
}

/** Reconstruct missing positions backwards, so several removals can be restored
 * in either order. Old tombstones came from undo-last and are placed before
 * rounds first created after their deletion. Never sort by wall-clock time. */
export function restoredRoundOrder(
  table: GameTable,
  rounds: GameRound[],
  id: string,
) {
  const history = table.roundHistory ?? [];
  const order = rounds.map((r) => r.id);
  for (let i = history.length - 1; i >= 0; i--) {
    const event = history[i];
    if (event.action !== 'deleted') continue;
    const existingIndex = order.indexOf(event.roundId);
    if (existingIndex >= 0) order.splice(existingIndex, 1);
    const old = event.roundOrderIds;
    const position = old?.indexOf(event.roundId) ?? -1;
    const successor =
      (position >= 0
        ? old!.slice(position + 1).find((key) => order.includes(key))
        : undefined) ??
      order.find((key) =>
        history.some(
          (e) =>
            e.roundId === key &&
            e.action === 'created' &&
            e.sequence > event.sequence,
        ),
      );
    const predecessor =
      position >= 0
        ? old!
            .slice(0, position)
            .reverse()
            .find((key) => order.includes(key))
        : undefined;
    const index = successor
      ? order.indexOf(successor)
      : predecessor
        ? order.indexOf(predecessor) + 1
        : order.length;
    order.splice(index, 0, event.roundId);
  }
  const retained = new Set([...rounds.map((r) => r.id), id]);
  return order.filter((key) => retained.has(key));
}

export type RoundHistoryDiff = { label: string; before: string; after: string };
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} €`;

export function roundHistorySummary(
  round: GameRound,
  players: { id: string; name: string }[],
) {
  const name = (id: string) =>
    players.find((p) => p.id === id)?.name ?? 'Unbekannt';
  if (round.gameType === 'custom')
    return 'Ausgleichsbuchung · individuelle Beträge';
  if (round.gameType === 'stock') return 'Stockbuchung';
  const unit =
    round.amount /
    Math.max(roundWinnerIds(round).length, round.loserIds.length, 1);
  return `${roundWinnerIds(round).map(name).join(' & ')} ${roundWinnerIds(round).length === 1 ? 'gewinnt' : 'gewinnen'} · ${money(unit)} je Spieler`;
}

/** Only business values, never IDs, timestamps or unchanged technical metadata. */
export function roundHistoryDiff(event: RoundHistoryEvent): RoundHistoryDiff[] {
  const { before, after } = event;
  if (!before || !after) return [];
  const result: RoundHistoryDiff[] = [];
  const name = (id?: string) =>
    event.players.find((p) => p.id === id)?.name ?? 'Unbekannt';
  const add = <T>(
    label: string,
    a: T,
    b: T,
    format: (v: T) => string = (value) => String(value),
  ) => {
    if (canonical(a) !== canonical(b))
      result.push({ label, before: format(a), after: format(b) });
  };
  add('Spielart', before.gameType, after.gameType, (v) =>
    formatRoundGameType(v),
  );
  add(
    'Kartenfarbe',
    before.suit ?? '',
    after.suit ?? '',
    (v) => cardSuits.find((s) => s.id === v)?.label ?? 'Keine',
  );
  add('Ansager', before.declarerId, after.declarerId, name);
  add('Partner', before.partnerId, after.partnerId, name);
  const winners = (r: GameRound) => [...roundWinnerIds(r)].sort();
  const losers = (r: GameRound) => [...r.loserIds].sort();
  if (
    before.declarerId &&
    before.declarerId === after.declarerId &&
    winners(before).includes(before.declarerId) !==
      winners(after).includes(after.declarerId!)
  )
    add(
      'Ergebnis',
      winners(before).includes(before.declarerId),
      winners(after).includes(after.declarerId!),
      (v) => (v ? 'Gewonnen' : 'Verloren'),
    );
  const reversedParties =
    !!before.declarerId &&
    before.declarerId === after.declarerId &&
    canonical(winners(before)) === canonical(losers(after)) &&
    canonical(losers(before)) === canonical(winners(after));
  if (!reversedParties) {
    add(
      'Gewinner',
      winners(before),
      winners(after),
      (v: string[]) => v.map(name).join(', ') || 'Keine',
    );
    add(
      'Verlierer',
      losers(before),
      losers(after),
      (v: string[]) => v.map(name).join(', ') || 'Keine',
    );
  }
  const unit = (r: GameRound) =>
    (toSafeCents(r.amount) ?? 0) /
    Math.max(winners(r).length, losers(r).length, 1);
  if (before.gameType !== 'custom' && after.gameType !== 'custom') {
    add('Tarif je Spieler', unit(before), unit(after), (v) => money(v / 100));
    // Changing the party sizes can change total volume even at the same tariff.
    if (unit(before) === unit(after))
      add('Gesamtbetrag', before.amount, after.amount, money);
  }
  add('Berechnung', !!before.tariffOptions, !!after.tariffOptions, (v) =>
    v ? 'Automatischer Tarif' : 'Manuell',
  );
  for (const [key, label] of Object.entries({
    laufende: 'Laufende',
    schneider: 'Schneider',
    schwarz: 'Schwarz',
    stoss: 'Kontra / Re · Stufen',
    legerCount: 'Geklopft',
    turboRamsch: 'Turbo Ramsch',
    jungfrauen: 'Jungfrauen',
    durchmarsch: 'Durchmarsch',
  })) {
    const a =
      before.tariffOptions?.[
        key as keyof NonNullable<GameRound['tariffOptions']>
      ];
    const b =
      after.tariffOptions?.[
        key as keyof NonNullable<GameRound['tariffOptions']>
      ];
    add(label, a, b, (v) =>
      v === undefined
        ? 'Nicht erfasst'
        : typeof v === 'boolean'
          ? v
            ? 'Ja'
            : 'Nein'
          : String(v),
    );
  }
  add(
    'Klopfende Spieler',
    before.roundContext?.legerPlayerIds?.slice().sort(),
    after.roundContext?.legerPlayerIds?.slice().sort(),
    (v: string[] | undefined) => v?.map(name).join(', ') || 'Keine',
  );
  const customA = new Map(
    before.customAmounts?.map((p) => [p.playerId, p.amount]),
  );
  const customB = new Map(
    after.customAmounts?.map((p) => [p.playerId, p.amount]),
  );
  for (const id of new Set([...customA.keys(), ...customB.keys()]))
    add(
      `Betrag · ${name(id)}`,
      customA.get(id) ?? 0,
      customB.get(id) ?? 0,
      (v) => `${v > 0 ? '+' : ''}${money(v)}`,
    );
  add('Stock vorher', before.stockBeforeCents, after.stockBeforeCents, (v) =>
    v === undefined ? 'Nicht erfasst' : money(v / 100),
  );
  add('Stock danach', before.stockAfterCents, after.stockAfterCents, (v) =>
    v === undefined ? 'Nicht erfasst' : money(v / 100),
  );
  add(
    'Stockbuchung',
    before.stockAction ?? '',
    after.stockAction ?? '',
    (v) =>
      (
        ({
          deposit: 'Einzahlung',
          payout: 'Auszahlung',
          double: 'Verdopplung',
          refund: 'Rückzahlung',
          carryIn: 'Übernahme',
          carryOut: 'Übertrag',
        }) as Record<string, string>
      )[v] ?? 'Keine',
  );
  return result;
}
