import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { IwpcWindow } from '../iwpc-window/iwpcWindow';

import { useIwpcReady } from './useIwpcReady';

type ReadyStatus = ReturnType<typeof useIwpcReady>;

/**
 * Minimal stand-in for an IwpcWindow: the hook only ever reads `.ready`.
 * Using a controllable deferred lets each test settle the handshake on demand.
 */
function makeReadyStub(): {
  iwpc: IwpcWindow;
  resolve: () => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const ready = new Promise<boolean>((res, rej) => {
    resolve = () => res(true);
    reject = rej;
  });
  // Swallow rejection so an unawaited reject does not surface as unhandled.
  ready.catch(() => undefined);
  return { iwpc: { ready } as unknown as IwpcWindow, resolve, reject };
}

function Harness({
  iwpc,
  onValue
}: {
  iwpc: IwpcWindow | undefined;
  onValue: (value: ReadyStatus) => void;
}) {
  const status = useIwpcReady(iwpc);
  useEffect(() => {
    onValue(status);
  });
  return null;
}

const renders: ReturnType<typeof render>[] = [];

afterEach(() => {
  while (renders.length) renders.pop()?.unmount();
});

function tracked(r: ReturnType<typeof render>) {
  renders.push(r);
  return r;
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

describe('useIwpcReady', () => {
  it("stays 'pending' while iwpc is undefined", async () => {
    const seen: ReadyStatus[] = [];
    tracked(render(<Harness iwpc={undefined} onValue={(v) => seen.push(v)} />));
    await flush();
    expect(seen.at(-1)).toBe('pending');
  });

  it("transitions to 'ready' when iwpc.ready resolves", async () => {
    const { iwpc, resolve } = makeReadyStub();
    const seen: ReadyStatus[] = [];
    tracked(render(<Harness iwpc={iwpc} onValue={(v) => seen.push(v)} />));
    await flush();
    expect(seen.at(-1)).toBe('pending');

    resolve();
    await flush();
    expect(seen.at(-1)).toBe('ready');
  });

  it("transitions to 'failed' when iwpc.ready rejects", async () => {
    const { iwpc, reject } = makeReadyStub();
    const seen: ReadyStatus[] = [];
    tracked(render(<Harness iwpc={iwpc} onValue={(v) => seen.push(v)} />));
    await flush();

    reject(new Error('handshake timed out'));
    await flush();
    expect(seen.at(-1)).toBe('failed');
  });

  it("re-subscribes and resets to 'pending' when iwpc is swapped", async () => {
    const first = makeReadyStub();
    const seen: ReadyStatus[] = [];
    const r = tracked(
      render(<Harness iwpc={first.iwpc} onValue={(v) => seen.push(v)} />)
    );
    await flush();
    first.resolve();
    await flush();
    expect(seen.at(-1)).toBe('ready');

    const second = makeReadyStub();
    r.rerender(<Harness iwpc={second.iwpc} onValue={(v) => seen.push(v)} />);
    await flush();
    // The new instance has not settled yet, so status falls back to pending.
    expect(seen.at(-1)).toBe('pending');

    second.resolve();
    await flush();
    expect(seen.at(-1)).toBe('ready');
  });

  it('does not update state after unmount when the old ready settles late', async () => {
    const { iwpc, resolve } = makeReadyStub();
    const seen: ReadyStatus[] = [];
    const r = tracked(
      render(<Harness iwpc={iwpc} onValue={(v) => seen.push(v)} />)
    );
    await flush();

    r.unmount();
    renders.pop();
    const countAtUnmount = seen.length;

    // Settling after unmount must not push another status (cancelled guard).
    resolve();
    await flush();
    expect(seen.length).toBe(countAtUnmount);
  });
});
