import {
  areTableOrderIdsEqual,
  sanitizeTableOrderIds,
} from '../utils/tableOrder';

describe('table order helpers', () => {
  it('drops invalid, duplicate, and unknown ids from persisted order data', () => {
    expect(
      sanitizeTableOrderIds(
        [' table-1 ', 'table-2', 'table-1', 12, '', null, 'stale-table'],
        ['table-1', 'table-2'],
      ),
    ).toEqual(['table-1', 'table-2']);
  });

  it('recovers safely when persisted order data is not an array', () => {
    expect(sanitizeTableOrderIds({ value: ['table-1'] })).toEqual([]);
    expect(sanitizeTableOrderIds('table-1')).toEqual([]);
  });

  it('compares table order ids without relying on reference equality', () => {
    expect(areTableOrderIdsEqual(['one', 'two'], ['one', 'two'])).toBe(true);
    expect(areTableOrderIdsEqual(['one', 'two'], ['two', 'one'])).toBe(false);
  });
});
