import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sortOptionalStrings } from './sortOptionalStrings';

test('sorts dates and bill numbers in either direction with missing values last', () => {
  const items = [
    { id: 'later', loadingDate: '2026-03-01', billNumber: 'B-02', unloadingDate: '2026-03-03' },
    { id: 'missing', loadingDate: '', billNumber: '', unloadingDate: '' },
    { id: 'earlier', loadingDate: '2026-01-01', billNumber: 'B-01', unloadingDate: '2026-01-03' }
  ];

  for (const field of ['loadingDate', 'billNumber', 'unloadingDate'] as const) {
    assert.deepEqual(sortOptionalStrings(items, item => item[field], true).map(item => item.id), ['earlier', 'later', 'missing']);
    assert.deepEqual(sortOptionalStrings(items, item => item[field], false).map(item => item.id), ['later', 'earlier', 'missing']);
  }
  assert.deepEqual(items.map(item => item.id), ['later', 'missing', 'earlier']);
});

test('preserves order for equal and missing values', () => {
  const values = [
    { id: 1, value: undefined }, { id: 2, value: 'A' }, { id: 3, value: null },
    { id: 4, value: 'A' }, { id: 5, value: '' }
  ];
  assert.deepEqual(sortOptionalStrings(values, item => item.value, true).map(item => item.id), [2, 4, 1, 3, 5]);
});
