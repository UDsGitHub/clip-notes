/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

// happy-dom lacks the Popover API (Chrome has it from 114; the extension needs 123).
for (const method of ['showPopover', 'hidePopover', 'togglePopover'] as const) {
  if (!(method in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, method, { value() {}, configurable: true });
  }
}
