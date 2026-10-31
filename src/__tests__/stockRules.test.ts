import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultTableSettings } from '../constants/tableSettings';
import { createGameRound } from '../services/game/createRound';
import { captureGameState } from '../services/sync/syncGameState';
import { reliableStorage } from '../storage/reliableStorage';
import {
  validCloudSnapshot,
  validGameSnapshot,
} from '../storage/validateGameState';
import { useGameStore } from '../store/gameStore';
import type { CreateRoundPayload } from '../types/game';
import {
  calculateRoundBalances,
  getStockBalanceCents,
  isPlayedRound,
  toSafeCents,
} from '../utils/accounting';
import { createStatisticsTable } from '../utils/statistics';
import { replayStockRules, stockMode } from '../utils/stockRules';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  isLocal: true,
}));
const blank = {
  currentTable: null,
  activeGame: false,
  players: [],
  rounds: [],
  balances: [],
  settlements: [],
  archivedGameDays: [],
  games: [],
};
const s = () => useGameStore.getState();
const pot = () => getStockBalanceCents(s().rounds);
const balances = () => s().balances.map((b) => b.amount);
function mode(value: 'stock' | 'ramsch' | 'off') {
  const settings = structuredClone(s().currentTable!.settings);
  settings.games.stock.enabled = value === 'stock';
  settings.games.ramsch.enabled = value === 'ramsch';
  return s().updateCurrentTableSettings(settings);
}
const deposit = (): CreateRoundPayload => ({
  gameType: 'stock',
  winnerId: '',
  winnerIds: [],
  loserIds: players.map((p) => p.id),
  amount: 0.8,
  stockAction: 'deposit',
});
const sauspiel = (
  won = true,
  caller = 'a',
  partner = 'b',
): CreateRoundPayload => {
  const own = [caller, partner];
  const other = players.map((p) => p.id).filter((id) => !own.includes(id));
  return {
    gameType: 'rufspiel',
    declarerId: caller,
    partnerId: partner,
    winnerId: (won ? own : other)[0],
    winnerIds: won ? own : other,
    loserIds: won ? other : own,
    amount: 0.4,
  };
};
beforeEach(async () => {
  await reliableStorage.flush();
  useGameStore.setState(blank);
  const settings = createDefaultTableSettings();
  settings.games.stock.enabled = true;
  s().createTable('Stockregeln', players, settings);
});
afterEach(async () => {
  await reliableStorage.retryWrites();
  await reliableStorage.flush();
});
it('defaults the initial stake to the Rufspiel base tariff', () => {
  const settings = createDefaultTableSettings();
  expect(settings.games.stock.value).toBe(settings.games.rufspiel.value);
});
it('replays the issue example with ordinary winnings plus automatic loss doubling and payout', () => {
  expect(s().addRound(deposit())).toBe(true);
  expect(pot()).toBe(80);
  expect(balances()).toEqual([-0.2, -0.2, -0.2, -0.2]);
  expect(s().addRound(sauspiel(false))).toBe(true);
  expect(pot()).toBe(160);
  expect(balances()).toEqual([-0.8, -0.8, 0, 0]);
  expect(s().rounds[1]).toMatchObject({
    stockAction: 'double',
    stockBeforeCents: 80,
    stockAfterCents: 160,
  });
  expect(s().addRound(sauspiel())).toBe(true);
  expect(pot()).toBe(0);
  expect(balances()).toEqual([0.2, 0.2, -0.2, -0.2]);
  expect(s().rounds[2]).toMatchObject({
    stockAction: 'payout',
    stockBeforeCents: 160,
    stockAfterCents: 0,
  });
  expect(validGameSnapshot(s())).toBe(true);
});
it.each([true, false])(
  'leaves an empty stock untouched on a Sauspiel, won=%s',
  (won) => {
    expect(s().addRound(sauspiel(won))).toBe(true);
    expect(pot()).toBe(0);
    expect(s().rounds[0].stockAction).toBeUndefined();
  },
);
it('does not infer a calling party from winners, including for a loss', () => {
  s().addRound(deposit());
  expect(
    s().addRound({
      ...sauspiel(false),
      declarerId: undefined,
      partnerId: undefined,
    }),
  ).toBe(false);
  expect(s().addRound({ ...sauspiel(false), partnerId: 'c' })).toBe(false);
  expect(pot()).toBe(80);
  expect(s().rounds).toHaveLength(1);
});
it('keeps the stock unchanged on Solo and Wenz', () => {
  s().addRound(deposit());
  for (const gameType of ['solo', 'wenz'] as const)
    expect(
      s().addRound({
        gameType,
        winnerId: 'a',
        loserIds: ['b', 'c', 'd'],
        declarerId: 'a',
        amount: 1.5,
      }),
    ).toBe(true);
  expect(pot()).toBe(80);
  expect(
    s()
      .rounds.slice(1)
      .every((r) => r.stockAction === undefined),
  ).toBe(true);
});
it('blocks a funded mode switch at the store boundary and preserves all money and rounds', () => {
  s().addRound(deposit());
  const before = structuredClone({
    table: s().currentTable,
    rounds: s().rounds,
    balances: s().balances,
  });
  expect(mode('ramsch')).toBe(false);
  expect(mode('off')).toBe(false);
  expect({
    table: s().currentTable,
    rounds: s().rounds,
    balances: s().balances,
  }).toEqual(before);
});
it('allows all three modes after games at zero stock and preserves historical snapshots', () => {
  s().addRound(sauspiel());
  const old = structuredClone(s().rounds);
  expect(mode('ramsch')).toBe(true);
  expect(stockMode(s().currentTable!.settings)).toBe('ramsch');
  expect(
    s().addRound({
      gameType: 'ramsch',
      winnerId: 'b',
      winnerIds: ['b', 'c', 'd'],
      loserIds: ['a'],
      amount: 0.6,
    }),
  ).toBe(true);
  expect(mode('off')).toBe(true);
  expect(s().addRound(deposit())).toBe(false);
  expect(
    s().addRound({
      gameType: 'ramsch',
      winnerId: 'b',
      winnerIds: ['b', 'c', 'd'],
      loserIds: ['a'],
      amount: 0.6,
    }),
  ).toBe(false);
  expect(mode('stock')).toBe(true);
  expect(s().rounds[0]).toEqual(old[0]);
});
it('rejects enabling Stock and Ramsch together on creation and on update', () => {
  const settings = structuredClone(s().currentTable!.settings);
  settings.games.ramsch.enabled = true;
  expect(s().updateCurrentTableSettings(settings)).toBe(false);
  useGameStore.setState(blank);
  expect(s().createTable('Ungültig', players, settings)).toBe(false);
});
it('changes the stake only for subsequent deposits while the pot is funded', () => {
  s().addRound(deposit());
  const original = structuredClone(s().rounds[0]);
  const settings = structuredClone(s().currentTable!.settings);
  settings.games.stock.value = 0.35;
  expect(s().updateCurrentTableSettings(settings)).toBe(true);
  expect(pot()).toBe(80);
  expect(s().addRound({ ...deposit(), amount: 1.4 })).toBe(true);
  expect(pot()).toBe(220);
  expect(s().rounds[0]).toEqual(original);
  expect(balances()).toEqual([-0.55, -0.55, -0.55, -0.55]);
});
it('recalculates following payouts after correcting a loss without changing identities or the current dealer', () => {
  s().addRound(deposit());
  s().addRound(sauspiel(false));
  s().addRound(sauspiel());
  const rounds = structuredClone(s().rounds);
  const dealer = s().currentTable!.dealerId;
  expect(s().updateRound(rounds[1].id, sauspiel())).toBe(true);
  expect(s().rounds.map((r) => r.id)).toEqual(rounds.map((r) => r.id));
  expect(s().rounds[2].stockAction).toBeUndefined();
  expect(s().rounds[2].stockBeforeCents).toBe(0);
  expect(s().currentTable!.dealerId).toBe(dealer);
  expect(balances()).toEqual([0.6, 0.6, -0.6, -0.6]);
  expect(validGameSnapshot(s())).toBe(true);
});
it('rejects a correction across a now-invalid later mode switch, with an actionable conflict', () => {
  s().addRound(deposit());
  s().addRound(sauspiel());
  const firstWin = s().rounds[1].id;
  mode('ramsch');
  s().addRound({
    gameType: 'ramsch',
    winnerId: 'a',
    winnerIds: ['a', 'b', 'c'],
    loserIds: ['d'],
    amount: 0.6,
  });
  const before = structuredClone({
    rounds: s().rounds,
    balances: s().balances,
    table: s().currentTable,
  });
  expect(s().updateRound(firstWin, sauspiel(false))).toBe(false);
  expect(s().roundError).toContain('späteren Regelwechsel');
  expect({
    rounds: s().rounds,
    balances: s().balances,
    table: s().currentTable,
  }).toEqual(before);
});
it('protects a mode switch made after the last game when undo would leave stock behind', () => {
  s().addRound(deposit());
  s().addRound(sauspiel());
  mode('off');
  expect(s().undoLastRound()).toBe(false);
  expect(s().roundError).toContain('Regelwechsel');
  expect(mode('stock')).toBe(true);
  expect(s().undoLastRound()).toBe(true);
  expect(pot()).toBe(80);
});
it('counts lost Sauspiele as games and keeps stock money out of played win/loss statistics', () => {
  s().addRound(deposit());
  s().addRound(sauspiel(false));
  expect(isPlayedRound(s().rounds[1])).toBe(true);
  const stats = createStatisticsTable(
    s().currentTable!.id,
    'Stock',
    players,
    s().rounds,
    { kind: 'active' },
    'id',
  );
  expect(stats.rounds).toHaveLength(1);
  expect(stats.rounds[0].deltas.a).toBe(-20);
  expect(stats.stockBookings).toBe(1);
});
it('rejects tampered stock audit metadata and retains the full flow through restart and cloud snapshot validation', async () => {
  s().addRound(deposit());
  s().addRound(sauspiel(false));
  await reliableStorage.flush();
  const saved = (await AsyncStorage.getItem('schafkopfrechner-games'))!;
  const expected = structuredClone(s().rounds);
  expect(validCloudSnapshot(captureGameState())).toBe(true);
  const corrupt = JSON.parse(saved).state;
  corrupt.rounds[1].stockAfterCents = 999;
  expect(validGameSnapshot(corrupt)).toBe(false);
  useGameStore.setState(blank);
  await reliableStorage.flush();
  await AsyncStorage.setItem('schafkopfrechner-games', saved);
  await useGameStore.persist.rehydrate();
  expect(s().rounds).toEqual(expected);
  expect(pot()).toBe(160);
  expect(s().finishGameDay('refund')).toBe(true);
  expect(s().archivedGameDays[0].rounds.slice(0, 2)).toEqual(expected);
});
it('shares odd cents deterministically between the calling partners and never creates or loses a cent', () => {
  const legacy = createGameRound(s().currentTable!.id, {
    ...deposit(),
    loserIds: ['a', 'b', 'c'],
    amount: 0.03,
    stockAction: 'carryIn',
    settingsSnapshot: s().currentTable!.settings,
  });
  useGameStore.setState({
    rounds: [legacy],
    balances: calculateRoundBalances(players, [legacy], 'id'),
    settlements: [],
  });
  expect(s().addRound(sauspiel(false))).toBe(true);
  expect(pot()).toBe(6);
  expect(
    s().balances.reduce((sum, b) => sum + toSafeCents(b.amount)!, pot()),
  ).toBe(0);
  expect(s().addRound(sauspiel())).toBe(true);
  expect(pot()).toBe(0);
  expect(s().balances.reduce((sum, b) => sum + toSafeCents(b.amount)!, 0)).toBe(
    0,
  );
  expect(validGameSnapshot(s())).toBe(true);
});
it('retains legacy manual movements when replayed instead of applying new automatic rules retroactively', () => {
  const settings = s().currentTable!.settings;
  const old = [
    createGameRound(s().currentTable!.id, {
      ...deposit(),
      settingsSnapshot: settings,
    }),
    createGameRound(s().currentTable!.id, {
      ...sauspiel(false),
      settingsSnapshot: settings,
    }),
  ];
  expect(replayStockRules(old, s().currentTable)).toEqual(old);
  expect(getStockBalanceCents(old)).toBe(80);
});

it('keeps the fifth dealer out of Stock contributions and the paused player out of the saved final distribution', () => {
  useGameStore.setState(blank);
  const settings = createDefaultTableSettings();
  settings.games.stock.enabled = true;
  const five = [...players, { id: 'e', name: 'e', isLocal: true }];
  s().createTable('Fuenf', five, settings);
  expect(s().addRound({ ...deposit(), loserIds: ['b', 'c', 'd', 'e'] })).toBe(
    true,
  );
  expect(s().balances.find((b) => b.playerId === 'a')?.amount).toBe(0);
  expect(
    s().addRound({
      gameType: 'rufspiel',
      declarerId: 'b',
      partnerId: 'c',
      winnerId: 'd',
      winnerIds: ['d', 'e'],
      loserIds: ['b', 'c'],
      amount: 0.4,
    }),
  ).toBe(true);
  const history = structuredClone(s().rounds);
  s().setPlayerPaused(s().currentTable!.id, 'c', true);
  expect(s().finishGameDay('refund')).toBe(true);
  expect(s().rounds.at(-1)?.loserIds).toEqual(['a', 'b', 'd', 'e']);
  expect(s().rounds.slice(0, 2)).toEqual(history);
  expect(s().balances.find((b) => b.playerId === 'c')?.amount).toBe(-0.8);
  expect(
    s().balances.reduce((sum, b) => sum + toSafeCents(b.amount)!, pot()),
  ).toBe(0);
  expect(validGameSnapshot(s())).toBe(true);
});
it('rejects doubling an overflowing Stock atomically', () => {
  const legacy = createGameRound(s().currentTable!.id, {
    ...deposit(),
    loserIds: ['d'],
    amount: Number.MAX_SAFE_INTEGER / 100,
    stockAction: 'carryIn',
    settingsSnapshot: s().currentTable!.settings,
  });
  useGameStore.setState({
    rounds: [legacy],
    balances: calculateRoundBalances(players, [legacy], 'id'),
    settlements: [],
  });
  const before = structuredClone({
    rounds: s().rounds,
    balances: s().balances,
    table: s().currentTable,
  });
  expect(s().addRound(sauspiel(false))).toBe(false);
  expect({
    rounds: s().rounds,
    balances: s().balances,
    table: s().currentTable,
  }).toEqual(before);
});
