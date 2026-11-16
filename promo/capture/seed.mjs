// Erzeugt die Demo-Spielstände im Browser über die Store-Aktionen der App.
import { users } from './demo-data.mjs';

const [SEPP, VRONI, HIAS, RESI] = users.map((u) => u.id);
const ids = [SEPP, VRONI, HIAS, RESI];

/** Kleiner, fester Zufallsgenerator: gleiche Aufnahme bei jedem Lauf. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spielstärke je Spieler: bestimmt, wie oft jemand ansagt und gewinnt.
const skill = { [SEPP]: 0.74, [VRONI]: 0.7, [HIAS]: 0.46, [RESI]: 0.56 };
const soloist = { [SEPP]: 0.2, [VRONI]: 0.16, [HIAS]: 0.3, [RESI]: 0.1 };
const suits = ['eichel', 'gras', 'herz', 'schellen'];

function randomRound(random) {
  const declarer = ids[Math.floor(random() * 4)];
  const alone = random() < soloist[declarer];
  const type = alone ? (random() < 0.5 ? 'wenz' : 'solo') : 'rufspiel';
  const others = ids.filter((id) => id !== declarer);
  const partner = alone ? undefined : others[Math.floor(random() * 3)];
  const chance = alone ? skill[declarer] - 0.14 : (skill[declarer] + skill[partner]) / 2 - 0.08;
  const won = random() < chance;
  const schwarz = random() < 0.03;
  const schneider = !schwarz && random() < 0.22;
  const laufende = random() < 0.16 ? (type === 'wenz' ? 2 : 3) + Math.floor(random() * 2) : 0;
  const suit = type === 'solo' ? suits[Math.floor(random() * 4)] : type === 'rufspiel' ? suits[[0, 1, 3][Math.floor(random() * 3)]] : undefined;
  return { type, declarer, partner, won, schneider, schwarz, laufende, suit };
}

/** Die laufende Runde am Stammtisch: von Hand gesetzt, damit jede Spielart vorkommt. */
export const tonightRounds = [
  { type: 'rufspiel', suit: 'eichel', declarer: SEPP, partner: RESI, won: true },
  { type: 'rufspiel', suit: 'gras', declarer: HIAS, partner: VRONI, won: true, schneider: true },
  { type: 'wenz', declarer: VRONI, won: true, laufende: 2 },
  { type: 'rufspiel', suit: 'schellen', declarer: RESI, partner: HIAS, won: false },
  { type: 'solo', suit: 'eichel', declarer: HIAS, won: false, schneider: true },
  { type: 'rufspiel', suit: 'gras', declarer: SEPP, partner: VRONI, won: true, laufende: 3 },
  { type: 'rufspiel', suit: 'eichel', declarer: VRONI, partner: RESI, won: true },
  { type: 'wenz', declarer: SEPP, won: true },
  { type: 'rufspiel', suit: 'schellen', declarer: HIAS, partner: SEPP, won: true, schneider: true },
  { type: 'solo', suit: 'gras', declarer: RESI, won: true, laufende: 3 },
  { type: 'rufspiel', suit: 'eichel', declarer: VRONI, partner: HIAS, won: true, schneider: true, laufende: 4 },
];

export function demoPlan() {
  const random = rng(20261116);
  // Bewusst unter ~50 Runden: der Browser-Speicher (localStorage) fasst nur
  // rund 5 MB, sonst zeigt die Web-Version eine Speicherwarnung.
  const days = [
    { name: 'Kirchweih-Runde', start: '2026-10-18T15:05:00+02:00', count: 10 },
    { name: 'Stammtisch', start: '2026-11-06T19:08:00+01:00', count: 14 },
    { name: 'Stammtisch', start: '2026-11-13T19:26:00+01:00', count: 12 },
  ].map((day) => ({
    ...day,
    rounds: Array.from({ length: day.count }, () => randomRound(random)),
  }));
  return { days, tonight: { name: 'Stammtisch', start: '2026-11-20T19:58:00+01:00', rounds: tonightRounds } };
}

export const playersFor = () =>
  users.map((u) => ({ id: `p-${u.name.toLowerCase()}`, name: u.name, isLocal: false, userId: u.id }));

/** Läuft im Browser. Trägt eine Runde über `addRound` der App ein. */
export function addRoundInPage(round) {
  const promo = window.__promo;
  const store = promo.useGameStore;
  const state = store.getState();
  const settings = state.currentTable.settings;
  const byUser = (userId) => state.players.find((p) => p.userId === userId).id;
  const declarer = byUser(round.declarer);
  const partner = round.partner ? byUser(round.partner) : undefined;
  const party = [declarer, partner].filter(Boolean);
  const rest = state.players.map((p) => p.id).filter((id) => !party.includes(id));
  const winners = round.won ? party : rest;
  const losers = round.won ? rest : party;
  const options = {
    laufende: round.laufende ?? 0,
    schneider: !!round.schneider,
    schwarz: !!round.schwarz,
    stoss: 0,
    legerCount: 0,
    turboRamsch: false,
  };
  const tariff = promo.calculateRoundTariff(settings, round.type, options);
  const amount = promo.calculatePartyAmount(tariff.totalCents, round.type, winners.length, losers.length, settings.gameRules ? options : undefined);
  const ok = store.getState().addRound({
    gameType: round.type,
    ...(round.suit ? { suit: round.suit } : {}),
    winnerId: winners[0],
    winnerIds: winners,
    loserIds: losers,
    amount: amount.totalCents / 100,
    declarerId: declarer,
    ...(partner ? { partnerId: partner } : {}),
    tariffOptions: options,
  });
  if (!ok) throw new Error('Runde abgelehnt: ' + JSON.stringify(round) + ' ' + store.getState().roundError);
}

export function createTableInPage({ name, players }) {
  const promo = window.__promo;
  const settings = promo.createDefaultTableSettings();
  settings.games.wenz.enabled = true;
  if (!promo.useGameStore.getState().createTable(name, players, settings))
    throw new Error('Tisch abgelehnt');
}

/** Spielt alle Demo-Spieltage auf dem Handy des Erstellers ein. */
export async function seedDemo(page, setTime) {
  const idle = async () => {
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !window.__promo.useSharedTableStatus.getState().busy);
  };
  const plan = demoPlan();
  for (const day of [...plan.days, plan.tonight]) {
    let time = new Date(day.start).getTime();
    await setTime(time);
    await page.evaluate(createTableInPage, { name: day.name, players: playersFor() });
    for (const round of day.rounds) {
      time += 8 * 60000;
      await setTime(time);
      await page.evaluate(addRoundInPage, round);
    }
    await idle();
    if (day === plan.tonight) break;
    await setTime(time + 20 * 60000);
    const finished = await page.evaluate(() => {
      const store = window.__promo.useGameStore;
      const tableId = store.getState().currentTable.id;
      if (!store.getState().finishGameDay()) return false;
      // Alte Spieltage gelten als bezahlt, damit das Dashboard aufgeräumt wirkt.
      const day = store.getState().archivedGameDays.find((d) => d.table.id === tableId);
      day.settlements.forEach((s) => store.getState().markSettlementPaid(s.id, true, tableId));
      return true;
    });
    if (!finished) throw new Error('Spieltag nicht abgeschlossen: ' + day.name);
    await idle();
  }
}
