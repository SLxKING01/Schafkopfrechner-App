import type { Balance } from '../models/Balance';
import { calculateSettlements } from '../utils/calculateSettlements';

describe('calculateSettlements', () => {
  it('creates a minimal payment for one debtor and one creditor', () => {
    const balances: Balance[] = [
      { playerId: 'max', amount: 20 },
      { playerId: 'simon', amount: -20 },
    ];

    expect(calculateSettlements(balances)).toEqual([
      { fromPlayerId: 'simon', toPlayerId: 'max', amount: 20 },
    ]);
  });

  it('fully balances multiple debtors and creditors', () => {
    const balances: Balance[] = [
      { playerId: 'max', amount: 15 },
      { playerId: 'anna', amount: 5 },
      { playerId: 'simon', amount: -10 },
      { playerId: 'lisa', amount: -10 },
    ];
    const settlements = calculateSettlements(balances);

    expect(settlements).toEqual([
      { fromPlayerId: 'simon', toPlayerId: 'max', amount: 10 },
      { fromPlayerId: 'lisa', toPlayerId: 'max', amount: 5 },
      { fromPlayerId: 'lisa', toPlayerId: 'anna', amount: 5 },
    ]);
    expect(settlements.reduce((sum, item) => sum + item.amount, 0)).toBe(20);
  });

  it('does not create self payments or zero payments', () => {
    const settlements = calculateSettlements([
      { playerId: 'max', amount: 0 },
      { playerId: 'simon', amount: 10 },
      { playerId: 'anna', amount: -10 },
    ]);

    expect(settlements).toHaveLength(1);
    expect(settlements[0].fromPlayerId).not.toBe(settlements[0].toPlayerId);
    expect(settlements[0].amount).toBeGreaterThan(0);
  });
});
