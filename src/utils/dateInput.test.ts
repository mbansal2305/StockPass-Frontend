import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatDateInputValue, formatDateInputDraft, parseDateInputValue } from './dateInput';

test('parses typed day-month-year dates into API format', () => {
  for (const input of ['29 02 2024', '29/02/2024', '29022024', '29 / 02 / 2024']) {
    assert.equal(parseDateInputValue(input), '2024-02-29');
  }
  assert.equal(formatDateInputValue('2024-02-29'), '29/02/2024');
});

test('formats digits continuously without padding and accepts pasted dates', () => {
  const inputs = ['', '5', '30', '300', '3002', '30022', '30022026'];
  const expected = ['', '5', '30/', '30/0', '30/02/', '30/02/2', '30/02/2026'];
  assert.deepEqual(inputs.map(formatDateInputDraft), expected);
  assert.equal(formatDateInputDraft('29 / 02 / 2024'), '29/02/2024');
  assert.equal(formatDateInputDraft('290220241'), '29/02/2024');
});

test('rejects incomplete and invalid dates', () => {
  for (const input of ['', '01/02', '30/02/2026', '29/02/2023', '29/02/1900', '31/04/2024', '00/01/2024', '01/13/2024', '01/01/0000']) {
    assert.equal(parseDateInputValue(input), null);
  }
  assert.equal(parseDateInputValue('29/02/2000'), '2000-02-29');
});
