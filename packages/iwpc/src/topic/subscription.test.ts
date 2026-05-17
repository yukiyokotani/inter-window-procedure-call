import { describe, expect, it, vi } from 'vitest';

import { Subscription } from './subscription';

describe('Subscription', () => {
  it('invokes the unsubscribe callback exactly once when unsubscribe is called', () => {
    const cb = vi.fn();
    const sub = new Subscription(cb);
    sub.unsubscribe();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('invokes the callback again when unsubscribe is called multiple times (caller responsibility to guard)', () => {
    // The current Subscription implementation simply delegates each call. This
    // test pins that behaviour so a regression that swallows repeated calls is
    // surfaced explicitly.
    const cb = vi.fn();
    const sub = new Subscription(cb);
    sub.unsubscribe();
    sub.unsubscribe();
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
