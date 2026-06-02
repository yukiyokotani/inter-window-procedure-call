import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  asSender,
  FakeWindow,
  flush,
  linkOpen
} from '../test-helpers/fakeWindow';

import { IwpcWindow } from './iwpcWindow';

const live: IwpcWindow[] = [];

function trackedIwpc(w: FakeWindow): IwpcWindow {
  const i = new IwpcWindow(w as unknown as Window);
  live.push(i);
  return i;
}

function makeParent(origin = 'https://example.test'): {
  parent: FakeWindow;
  iwpc: IwpcWindow;
} {
  const parent = new FakeWindow({ origin });
  const iwpc = trackedIwpc(parent);
  // Parent has no opener → initialize resolves ready immediately, no postMessage.
  iwpc.initialize();
  return { parent, iwpc };
}

/**
 * Create a child IwpcWindow that targets `parentFake` as its opener, register
 * it under parent.open(), then trigger initialize() with parentFake at the
 * sender stack so the synthetic NOTIFY_WINDOW_ID is attributed correctly.
 *
 * The caller is responsible for `await parent.open('/child')` flow when needed.
 */
function buildChild(
  parentFake: FakeWindow,
  origin?: string
): { childFake: FakeWindow; childIwpc: IwpcWindow } {
  const childFake = new FakeWindow({ origin: origin ?? parentFake.location.origin });
  childFake.opener = parentFake;
  const childIwpc = trackedIwpc(childFake);
  return { childFake, childIwpc };
}

afterEach(() => {
  while (live.length) live.pop()?.dispose();
});

describe('IwpcWindow (postMessage transport)', () => {
  it('resolves ready immediately when there is no opener', async () => {
    const { iwpc } = makeParent();
    await expect(iwpc.ready).resolves.toBe(true);
  });

  it('reports its transport via the getter', () => {
    const { iwpc } = makeParent();
    expect(iwpc.transport).toBe('postMessage');
  });

  it('exchanges window ids via postMessage handshake', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    asSender(childFake, () => childIwpc.initialize());
    await flush();

    await expect(parentIwpc.ready).resolves.toBe(true);
    await expect(childIwpc.ready).resolves.toBe(true);
    expect(childIwpc.parentWindowId).toBe(parentIwpc.windowId);
    expect(childIwpc.parentIwpcWindow?.windowId).toBe(parentIwpc.windowId);
  });

  it('parent.open() resolves with a working IwpcWindowAgent', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    // Let parent.open's microtask continuation populate its resolve map
    // before the child fires the synthetic NOTIFY_WINDOW_ID.
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    const agent = await agentPromise;
    expect(agent.windowId).toBe(childIwpc.windowId);
  });

  it('register / invoke / RETURN round-trip works end-to-end', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    const agent = await agentPromise;

    const handler = vi.fn(() => 'pong');
    childIwpc.register('PING', handler);

    const result = await agent.invoke<undefined, string>('PING', undefined, {
      timeout: 500
    });
    expect(result).toBe('pong');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles async procedures and forwards their resolved value', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    const agent = await agentPromise;

    childIwpc.register('SLOW', async () => {
      await new Promise<void>((r) => setTimeout(r, 5));
      return 'eventually';
    });

    await expect(
      agent.invoke<undefined, string>('SLOW', undefined, { timeout: 500 })
    ).resolves.toBe('eventually');
  });

  it('propagates a thrown procedure error back to the caller', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    const agent = await agentPromise;

    childIwpc.register('BAD', () => {
      const err = new Error('boom');
      err.name = 'CustomBoom';
      throw err;
    });

    const caught = await agent
      .invoke('BAD', undefined, { timeout: 500 })
      .catch((e) => e);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('IwpcRemoteError');
    expect((caught as { remoteName?: string }).remoteName).toBe('CustomBoom');
    expect((caught as Error).message).toBe('boom');
  });

  it('maps a thrown string into a remote error carrying that string', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    const agent = await agentPromise;

    childIwpc.register('THROW_STRING', () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'plain failure';
    });

    const caught = await agent
      .invoke('THROW_STRING', undefined, { timeout: 500 })
      .catch((e) => e);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('IwpcRemoteError');
    expect((caught as Error).message).toBe('plain failure');
  });

  it('maps a thrown non-string value into a generic remote error', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    const agent = await agentPromise;

    childIwpc.register('THROW_OBJECT', () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw { code: 500 };
    });

    const caught = await agent
      .invoke('THROW_OBJECT', undefined, { timeout: 500 })
      .catch((e) => e);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('IwpcRemoteError');
    expect((caught as Error).message).toBe('Unknown error');
  });

  it('child can invoke parent procedures', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    await agentPromise;

    parentIwpc.register('PARENT_PROC', (n) => (n as number) + 1);
    const result = await childIwpc.parentIwpcWindow?.invoke<number, number>(
      'PARENT_PROC',
      41,
      { timeout: 500 }
    );
    expect(result).toBe(42);
  });

  it('rejects an invoke for an unregistered procedure with IwpcProcedureNotFound', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    const agent = await agentPromise;

    const caught = await agent
      .invoke('NOPE', undefined, { timeout: 200 })
      .catch((e) => e);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('IwpcProcedureNotFoundError');
  });

  it('unregister stops a procedure from being callable', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const { childFake, childIwpc } = buildChild(parent);
    linkOpen(parent, childFake);

    const agentPromise = parentIwpc.open('/child');
    await flush();
    asSender(childFake, () => childIwpc.initialize());
    const agent = await agentPromise;

    childIwpc.register('PING', () => 'pong');
    expect(await agent.invoke('PING', undefined, { timeout: 200 })).toBe('pong');

    childIwpc.unregister('PING');
    const caught = await agent
      .invoke('PING', undefined, { timeout: 200 })
      .catch((e) => e);
    expect((caught as Error).name).toBe('IwpcProcedureNotFoundError');
  });

  it('rejects handshake messages from a different origin (security)', async () => {
    const parent = new FakeWindow({ origin: 'https://parent.test' });
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();

    const ev = new MessageEvent('message', {
      data: { type: 'NOTIFY_WINDOW_ID', myWindowId: 'evil-id' },
      origin: 'https://evil.test',
      source: new FakeWindow({
        origin: 'https://evil.test'
      }) as unknown as MessageEventSource
    });
    parent.dispatchEvent(ev);
    await flush();

    expect(parentIwpc.parentWindowId).toBeUndefined();
  });

  it('ignores RECEIVED_WINDOW_ID coming from a different origin', async () => {
    const parent = new FakeWindow({ origin: 'https://parent.test' });
    const child = new FakeWindow({ origin: 'https://parent.test' });
    child.opener = parent;
    const childIwpc = trackedIwpc(child);
    asSender(child, () => childIwpc.initialize());
    await flush();

    // Now spoof a RECEIVED_WINDOW_ID from evil origin.
    const ev = new MessageEvent('message', {
      data: {
        type: 'RECEIVED_WINDOW_ID',
        yourWindowId: childIwpc.windowId,
        myWindowId: 'evil-parent'
      },
      origin: 'https://evil.test',
      source: new FakeWindow({
        origin: 'https://evil.test'
      }) as unknown as MessageEventSource
    });
    child.dispatchEvent(ev);
    await flush();
    expect(childIwpc.parentWindowId).not.toBe('evil-parent');
  });

  it('ignores RECEIVED_WINDOW_ID with the wrong yourWindowId', async () => {
    const parent = new FakeWindow({ origin: 'https://parent.test' });
    const child = new FakeWindow({ origin: 'https://parent.test' });
    child.opener = parent;
    const childIwpc = trackedIwpc(child);
    childIwpc.initialize();

    const wrong = new FakeWindow({ origin: 'https://parent.test' });
    const ev = new MessageEvent('message', {
      data: {
        type: 'RECEIVED_WINDOW_ID',
        yourWindowId: 'definitely-not-me',
        myWindowId: 'someone-else'
      },
      origin: 'https://parent.test',
      source: wrong as unknown as MessageEventSource
    });
    child.dispatchEvent(ev);
    await flush();
    expect(childIwpc.parentWindowId).toBeUndefined();
  });

  it('rejects handshake messages whose source is missing', async () => {
    const parent = new FakeWindow({ origin: 'https://parent.test' });
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();

    const ev = new MessageEvent('message', {
      data: { type: 'NOTIFY_WINDOW_ID', myWindowId: 'whatever' },
      origin: 'https://parent.test',
      source: null
    });
    parent.dispatchEvent(ev);
    await flush();
    expect(parentIwpc.parentWindowId).toBeUndefined();
  });

  it('rejects open() when window.open returns null (popup blocked)', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    linkOpen(parent, null);
    await expect(parentIwpc.open('/child')).rejects.toThrow(
      /Could not obtain a reference/
    );
  });

  it('rejects open() if the child never completes the handshake', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    const orphan = new FakeWindow({ origin: parent.location.origin });
    linkOpen(parent, orphan);
    // Never construct a child IwpcWindow → NOTIFY never arrives.
    await expect(parentIwpc.open('/orphan')).rejects.toThrow(/timed out/i);
  }, 10000);

  it('dispose actually removes the message listeners', async () => {
    const { parent, iwpc: parentIwpc } = makeParent();
    parentIwpc.dispose();

    const someChild = new FakeWindow({ origin: parent.location.origin });
    const ev = new MessageEvent('message', {
      data: { type: 'NOTIFY_WINDOW_ID', myWindowId: 'late' },
      origin: parent.location.origin,
      source: someChild as unknown as MessageEventSource
    });
    parent.dispatchEvent(ev);
    await flush();
    expect(parentIwpc.parentWindowId).toBeUndefined();
  });

  it('dispose is idempotent and ready rejects after disposal', async () => {
    const parent = new FakeWindow();
    parent.opener = new FakeWindow();
    const iwpc = trackedIwpc(parent);
    iwpc.initialize();
    iwpc.dispose();
    iwpc.dispose();
    await expect(iwpc.ready).rejects.toThrow(/disposed/i);
  });

  it('close() calls window.close after dispose', () => {
    const parent = new FakeWindow();
    const iwpc = trackedIwpc(parent);
    iwpc.initialize();
    iwpc.close();
    expect(parent.close).toHaveBeenCalled();
  });

  it('open() rejects if called on a disposed instance', async () => {
    const { iwpc: parentIwpc } = makeParent();
    await parentIwpc.ready;
    parentIwpc.dispose();
    await expect(parentIwpc.open('/child')).rejects.toThrow(/disposed/i);
  });

  it('window getter returns the underlying window', () => {
    const parent = new FakeWindow();
    const iwpc = trackedIwpc(parent);
    iwpc.initialize();
    expect(iwpc.window).toBe(parent);
  });

  it('windowId is a non-empty string', () => {
    const { iwpc } = makeParent();
    expect(typeof iwpc.windowId).toBe('string');
    expect(iwpc.windowId.length).toBeGreaterThan(0);
  });

  it('asSender helper attributes outgoing postMessage to the declared sender', () => {
    const a = new FakeWindow({ origin: 'https://a.test' });
    const b = new FakeWindow({ origin: 'https://b.test' });
    const received: MessageEvent[] = [];
    b.addEventListener('message', (e) => received.push(e as MessageEvent));
    asSender(a, () => b.postMessage('hi', '*'));
    expect(received[0]?.origin).toBe('https://a.test');
    expect(received[0]?.source).toBe(a);
    expect(received[0]?.data).toBe('hi');
  });
});
