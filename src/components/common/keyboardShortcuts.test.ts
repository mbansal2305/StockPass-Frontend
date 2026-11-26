import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { shouldIgnoreShortcut } from './keyboardShortcuts';

test('ignores shortcuts while typing, composing, using modifiers, or repeating', t => {
  class TestElement extends EventTarget {
    constructor(public isContentEditable: boolean, private matchesInput: boolean) {
      super();
    }

    closest() {
      return this.matchesInput ? this : null;
    }
  }

  const original = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
  Object.defineProperty(globalThis, 'HTMLElement', { value: TestElement, configurable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'HTMLElement', original);
    else Reflect.deleteProperty(globalThis, 'HTMLElement');
  });

  const event = (overrides: Partial<Parameters<typeof shouldIgnoreShortcut>[0]> = {}): Parameters<typeof shouldIgnoreShortcut>[0] => ({
    defaultPrevented: false,
    repeat: false,
    isComposing: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    target: null,
    ...overrides
  });

  assert.equal(shouldIgnoreShortcut(event()), false);
  assert.equal(shouldIgnoreShortcut(event({ target: new TestElement(false, false) })), false);
  assert.equal(shouldIgnoreShortcut(event({ target: new TestElement(false, true) })), true);
  assert.equal(shouldIgnoreShortcut(event({ target: new TestElement(true, false) })), true);
  for (const flag of ['defaultPrevented', 'repeat', 'isComposing', 'ctrlKey', 'altKey', 'metaKey'] as const) {
    assert.equal(shouldIgnoreShortcut(event({ [flag]: true })), true);
  }
});
