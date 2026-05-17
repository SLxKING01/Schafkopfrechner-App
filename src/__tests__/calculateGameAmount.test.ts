import { calculateGameAmount } from '../utils/calculateGameAmount';

describe('calculateGameAmount', () => {
  it('returns base amounts for all game types', () => {
    expect(calculateGameAmount('sauspiel')).toBe(10);
    expect(calculateGameAmount('wenz')).toBe(20);
    expect(calculateGameAmount('solo')).toBe(50);
    expect(calculateGameAmount('ramsch')).toBe(5);
  });

  it('adds laufende, schneider and schwarz', () => {
    expect(
      calculateGameAmount('sauspiel', {
        laufende: 2,
        schneider: true,
        schwarz: true,
      }),
    ).toBe(60);
  });

  it('is robust when options are missing', () => {
    expect(calculateGameAmount('unknown')).toBe(10);
    expect(calculateGameAmount('wenz', { laufende: 3 })).toBe(50);
  });
});
