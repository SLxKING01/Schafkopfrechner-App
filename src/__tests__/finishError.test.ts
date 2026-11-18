import {
  BalanceMismatchError,
  calculateMoneyTransfers,
  calculateRoundBalances,
} from '../utils/accounting';
import { describeFinishError } from '../utils/finishError';

const players = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('describeFinishError', () => {
  it('names the exact gap of unbalanced final balances', () => {
    let error: unknown;
    try {
      calculateMoneyTransfers([
        { playerId: 'a', amount: 2 },
        { playerId: 'b', amount: -2.25 },
      ]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BalanceMismatchError);
    expect((error as BalanceMismatchError).differenceCents).toBe(-25);
    expect(describeFinishError(error)).toContain(
      'Die Salden ergeben zusammen -0,25 € statt 0,00 €',
    );
  });

  it('names the gap of an unbalanced custom booking', () => {
    let error: unknown;
    try {
      calculateRoundBalances(players, [
        {
          gameType: 'custom',
          winnerId: '',
          winnerIds: [],
          loserIds: [],
          amount: 1,
          customAmounts: [
            { playerId: 'a', amount: 1 },
            { playerId: 'b', amount: -0.6 },
          ],
        },
      ]);
    } catch (e) {
      error = e;
    }
    expect(describeFinishError(error)).toContain('+0,40 € statt 0,00 €');
    expect(describeFinishError(error)).toContain('Differenz von 0,40 €');
  });

  it('falls back to a general hint for other errors', () => {
    expect(describeFinishError(new Error('x'))).toContain(
      'Ungültige Abrechnungsdaten werden nicht abgeschlossen.',
    );
  });
});
