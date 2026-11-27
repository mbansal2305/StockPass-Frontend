import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getAssignmentPopoverPosition } from './AssignmentPopover';

test('places the popover below the card and keeps it inside the right edge', () => {
  const result = getAssignmentPopoverPosition(
    { left: 900, right: 1000, top: 100, bottom: 160 },
    { width: 1024, height: 768 },
    250
  );
  assert.equal(result.above, false);
  assert.equal(result.top, 170);
  assert.equal(result.left + result.width, 1016);
  assert.ok(result.arrowLeft >= 12 && result.arrowLeft <= result.width - 12);
});

test('flips above the card when there is insufficient space below', () => {
  const result = getAssignmentPopoverPosition(
    { left: 100, right: 200, top: 600, bottom: 660 },
    { width: 1024, height: 768 },
    250
  );
  assert.equal(result.above, true);
  assert.equal(result.top, 340);
  assert.ok(result.top + 250 < 600);
});

test('constrains tall content to the available viewport', () => {
  const result = getAssignmentPopoverPosition(
    { left: 50, right: 150, top: 200, bottom: 260 },
    { width: 800, height: 400 },
    800
  );
  assert.equal(result.above, true);
  assert.equal(result.maxHeight, 182);
  assert.equal(result.top, 8);
});

test('anchors a narrow popover within a phone viewport', () => {
  const result = getAssignmentPopoverPosition(
    { left: 260, right: 310, top: 50, bottom: 100 },
    { width: 320, height: 600 },
    280
  );
  assert.equal(result.width, 304);
  assert.equal(result.left, 8);
  assert.equal(result.top, 110);
  assert.equal(result.above, false);
  assert.ok(result.arrowLeft <= result.width - 12);
});

test('keeps the popover inside an offset visual viewport when the keyboard is open', () => {
  const result = getAssignmentPopoverPosition(
    { left: 110, right: 200, top: 440, bottom: 500 },
    { width: 390, height: 320, left: 20, top: 200 },
    180
  );
  assert.equal(result.above, true);
  assert.equal(result.top, 250);
  assert.ok(result.left >= 28 && result.left + result.width <= 402);
  assert.ok(result.top >= 208 && result.top + 180 <= 512);
});
