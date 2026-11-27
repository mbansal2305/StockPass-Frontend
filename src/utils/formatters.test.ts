import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getShortUnitLabel } from './formatters';

test('shows compact quantity units without mislabelling unknown units', () => {
  assert.equal(getShortUnitLabel('quintal'), 'Qtl');
  assert.equal(getShortUnitLabel('mt'), 'MT');
  assert.equal(getShortUnitLabel('kg'), 'Kg');
  assert.equal(getShortUnitLabel('QTL'), 'Qtl');
  assert.equal(getShortUnitLabel('other'), 'other');
  assert.equal(getShortUnitLabel(), '');
});
