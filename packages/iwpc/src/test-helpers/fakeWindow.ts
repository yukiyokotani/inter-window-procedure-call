import { vi } from 'vitest';

type MessageEventInitLike = {
  data: unknown;
  origin: string;
  source: FakeWindow | null;
};

/**
 * In-process simulacrum of `window` good enough to exercise IwpcWindow.
 *
 * Source-tracking is contextual: a stack of "current windows" is pushed while
 * an event is being dispatched and while the test helper wraps a call with
 * {@link asSender}. When `postMessage` runs, it reads the top of the stack as
 * the synthetic `MessageEvent.source`. This is faithful enough for the
 * handshake flow because:
 *   - test code can declare "this call originates from window X" with
 *     `asSender(X, () => …)`,
 *   - while a window's own 'message' handler runs, that window is at the top
 *     of the stack, so any reply it sends has the correct source.
 */
export class FakeWindow {
  readonly addEventListener: (type: string, listener: EventListener) => void;
  readonly removeEventListener: (
    type: string,
    listener: EventListener
  ) => void;
  readonly dispatchEvent: (event: Event) => boolean;

  opener: FakeWindow | null = null;
  closed = false;
  location: {
    origin: string;
    href: string;
    search: string;
    pathname: string;
  };

  postMessage = vi.fn((data: unknown, targetOrigin: string): void => {
    if (targetOrigin !== '*' && targetOrigin !== this.location.origin) {
      return;
    }
    const source = currentSender();
    this._deliverMessage({
      data,
      origin: source?.location.origin ?? this.location.origin,
      source
    });
  });

  /**
   * Stub `window.open`. Tests can override this on a per-window basis.
   */
  open: (
    url?: string,
    target?: string,
    features?: string
  ) => FakeWindow | null = vi.fn(() => null);

  close = vi.fn(() => {
    this.closed = true;
  });

  private _eventTarget: EventTarget;

  constructor(
    options: {
      origin?: string;
      pathname?: string;
      search?: string;
    } = {}
  ) {
    const origin = options.origin ?? 'https://example.test';
    const pathname = options.pathname ?? '/';
    const search = options.search ?? '';
    this.location = {
      origin,
      pathname,
      search,
      get href() {
        return `${origin}${pathname}${search}`;
      }
    };
    this._eventTarget = new EventTarget();
    this.addEventListener = (type, listener) =>
      this._eventTarget.addEventListener(type, listener);
    this.removeEventListener = (type, listener) =>
      this._eventTarget.removeEventListener(type, listener);
    this.dispatchEvent = (event) => {
      senderStack.push(this);
      try {
        return this._eventTarget.dispatchEvent(event);
      } finally {
        senderStack.pop();
      }
    };
  }

  setSearch(search: string) {
    this.location.search = search.startsWith('?') ? search : `?${search}`;
  }

  private _deliverMessage(init: MessageEventInitLike) {
    const ev = new MessageEvent('message', {
      data: init.data,
      origin: init.origin,
      source: init.source as unknown as MessageEventSource | null
    });
    this.dispatchEvent(ev);
  }
}

const senderStack: FakeWindow[] = [];

function currentSender(): FakeWindow | null {
  return senderStack.length > 0 ? senderStack[senderStack.length - 1]! : null;
}

/**
 * Run `fn` such that any postMessage call made inside it attributes its
 * MessageEvent.source / origin to `sender`. Synchronous and async forms both
 * supported.
 */
export function asSender<T>(sender: FakeWindow, fn: () => T): T {
  senderStack.push(sender);
  try {
    return fn();
  } finally {
    senderStack.pop();
  }
}

/**
 * Wire `parent.open(url, ...)` to return `child` (with child.opener set to
 * parent) and capture the requested URL/options.
 */
export function linkOpen(
  parent: FakeWindow,
  child: FakeWindow | null
): {
  parent: FakeWindow;
  calls: Array<{
    url: string | undefined;
    target: string | undefined;
    features: string | undefined;
  }>;
} {
  const calls: Array<{
    url: string | undefined;
    target: string | undefined;
    features: string | undefined;
  }> = [];
  parent.open = vi.fn((url, target, features) => {
    calls.push({ url, target, features });
    if (child) {
      child.opener = parent;
    }
    return child;
  });
  return { parent, calls };
}

/**
 * Wait long enough for any queued microtasks / macrotasks (including
 * BroadcastChannel delivery) to run.
 */
export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}
