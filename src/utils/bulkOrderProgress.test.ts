import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calculateBulkOrderProgress } from './bulkOrderProgress';

test('projects fulfillment from the current order entry', () => {
  assert.deepEqual(calculateBulkOrderProgress(100, 30, 20, 0), {
    fulfilled: 50, remaining: 50, available: 70
  });
  assert.deepEqual(calculateBulkOrderProgress(100, 30, 80, 0), {
    fulfilled: 110, remaining: -10, available: 70
  });
});

test('replaces the saved entry when editing the same order', () => {
  assert.deepEqual(calculateBulkOrderProgress(100, 50, 25, 20), {
    fulfilled: 55, remaining: 45, available: 70
  });
  assert.deepEqual(calculateBulkOrderProgress(100, 50, 0, 20), {
    fulfilled: 30, remaining: 70, available: 70
  });
});
