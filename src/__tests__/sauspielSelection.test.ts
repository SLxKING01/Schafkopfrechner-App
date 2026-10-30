import { selectSauspielResult } from '../utils/sauspielSelection';

const roster = ['a', 'b', 'c', 'd'];
it.each([true, false])(
  'completes the opposite pair after two results, won=%s',
  (won) => {
    const first = selectSauspielResult(roster, [], [], 'a', won);
    const result = selectSauspielResult(
      roster,
      first.winners,
      first.losers,
      'c',
      won,
    );
    expect(result).toEqual(
      won
        ? { winners: ['a', 'c'], losers: ['b', 'd'] }
        : { winners: ['b', 'd'], losers: ['a', 'c'] },
    );
  },
);
it('combines mixed input without marking any player as both winner and loser', () => {
  const a = selectSauspielResult(roster, [], [], 'a', true);
  const b = selectSauspielResult(roster, a.winners, a.losers, 'b', false);
  expect(b).toEqual({ winners: ['a'], losers: ['b'] });
  expect(selectSauspielResult(roster, b.winners, b.losers, 'c', true)).toEqual({
    winners: ['a', 'c'],
    losers: ['b', 'd'],
  });
});
it('keeps selected results stable and starts a new pair on a third selection', () => {
  expect(
    selectSauspielResult(roster, ['a', 'b'], ['c', 'd'], 'a', true),
  ).toEqual({ winners: ['a', 'b'], losers: ['c', 'd'] });
  expect(
    selectSauspielResult(roster, ['a', 'b'], ['c', 'd'], 'c', true),
  ).toEqual({ winners: ['c'], losers: [] });
});
it('never chooses participants from a larger roster without explicit results', () => {
  expect(selectSauspielResult([...roster, 'e'], ['a'], [], 'b', true)).toEqual({
    winners: ['a', 'b'],
    losers: [],
  });
});
