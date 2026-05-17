import { describe, expect, it } from 'vitest';

import { messageEventSourceIsWindow } from './utils';

describe('messageEventSourceIsWindow', () => {
  it('returns true for the current global window', () => {
    expect(messageEventSourceIsWindow(window)).toBe(true);
  });

  it('returns true for a duck-typed source with postMessage and without the unsupported branches', () => {
    const duck = { postMessage: () => {} } as unknown as Parameters<
      typeof messageEventSourceIsWindow
    >[0];
    expect(messageEventSourceIsWindow(duck)).toBe(true);
  });

  it('returns false for a source without a postMessage method', () => {
    const noPostMessage = {} as unknown as Parameters<
      typeof messageEventSourceIsWindow
    >[0];
    expect(messageEventSourceIsWindow(noPostMessage)).toBe(false);
  });
});
