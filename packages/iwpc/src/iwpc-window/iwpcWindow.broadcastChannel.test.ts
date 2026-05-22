import { afterEach, describe, expect, it, vi } from 'vitest';

import { FakeWindow, flush } from '../test-helpers/fakeWindow';

import { IWPC_WINDOW_ID_QUERY_PARAM } from './constants';
import { IwpcWindow } from './iwpcWindow';

const live: IwpcWindow[] = [];

function trackedIwpc(w: FakeWindow): IwpcWindow {
  const i = new IwpcWindow(w as unknown as Window, {
    transport: 'broadcastChannel'
  });
  live.push(i);
  return i;
}

afterEach(() => {
  while (live.length) live.pop()?.dispose();
});

describe('IwpcWindow (broadcastChannel transport)', () => {
  it('reports its transport via the getter', () => {
    const parent = new FakeWindow();
    const iwpc = trackedIwpc(parent);
    iwpc.initialize();
    expect(iwpc.transport).toBe('broadcastChannel');
  });

  it('runs as a root window when no parent id is in the URL', async () => {
    const root = new FakeWindow();
    const iwpc = trackedIwpc(root);
    iwpc.initialize();
    await expect(iwpc.ready).resolves.toBe(true);
    expect(iwpc.parentWindowId).toBeUndefined();
    expect(iwpc.parentIwpcWindow).toBeUndefined();
  });

  it('reads its own id from URL query parameters', () => {
    const child = new FakeWindow();
    child.setSearch(`${IWPC_WINDOW_ID_QUERY_PARAM}=child-id-123`);
    const iwpc = trackedIwpc(child);
    iwpc.initialize();
    expect(iwpc.windowId).toBe('child-id-123');
    // No parent has acked yet, so parent fields stay undefined.
    expect(iwpc.parentWindowId).toBeUndefined();
    expect(iwpc.parentIwpcWindow).toBeUndefined();
  });

  it("learns its parent's id from the RECEIVED ack, not from the URL", async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    let capturedUrl = '';
    parent.open = vi.fn((url) => {
      capturedUrl = url ?? '';
      return null;
    });

    const openPromise = parentIwpc.open('/child');
    await flush();

    const params = new URLSearchParams(capturedUrl.split('?')[1]);
    // Child id is in the URL, parent id is NOT.
    expect(typeof params.get(IWPC_WINDOW_ID_QUERY_PARAM)).toBe('string');
    expect(params.has('__iwpcParentId')).toBe(false);

    const child = new FakeWindow();
    child.setSearch(capturedUrl.slice(capturedUrl.indexOf('?')));
    const childIwpc = trackedIwpc(child);
    childIwpc.initialize();

    await openPromise;
    await childIwpc.ready;
    expect(childIwpc.parentWindowId).toBe(parentIwpc.windowId);
    expect(childIwpc.parentIwpcWindow?.windowId).toBe(parentIwpc.windowId);
  });

  it('open() appends only the child id query param to the URL and opens with noopener', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    const captured: Array<{
      url?: string;
      target?: string;
      features?: string;
    }> = [];
    parent.open = vi.fn((url, target, features) => {
      captured.push({ url, target, features });
      return null;
    });

    const openPromise = parentIwpc.open('/child');
    openPromise.catch(() => undefined);
    await flush();

    expect(captured).toHaveLength(1);
    const call = captured[0]!;
    expect(call.features).toContain('noopener');
    const url = call.url as string;
    expect(url).toContain(IWPC_WINDOW_ID_QUERY_PARAM);
    expect(url).not.toContain('__iwpcParentId');
    const params = new URLSearchParams(url.split('?')[1]);
    expect(typeof params.get(IWPC_WINDOW_ID_QUERY_PARAM)).toBe('string');
  });

  it('parent.open() resolves when the child broadcasts NOTIFY_WINDOW_ID', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    let capturedUrl = '';
    parent.open = vi.fn((url) => {
      capturedUrl = url ?? '';
      return null;
    });

    const openPromise = parentIwpc.open('/child');
    await flush();

    const child = new FakeWindow();
    child.setSearch(capturedUrl.slice(capturedUrl.indexOf('?')));
    const childIwpc = trackedIwpc(child);
    childIwpc.initialize();

    const agent = await openPromise;
    expect(agent.windowId).toBe(childIwpc.windowId);
    expect(agent.windowId).toBe(
      new URLSearchParams(capturedUrl.split('?')[1]).get(
        IWPC_WINDOW_ID_QUERY_PARAM
      )
    );
  });

  it('end-to-end: parent invokes child procedure', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    let capturedUrl = '';
    parent.open = vi.fn((url) => {
      capturedUrl = url ?? '';
      return null;
    });

    const openPromise = parentIwpc.open('/child');
    await flush();

    const child = new FakeWindow();
    child.setSearch(capturedUrl.slice(capturedUrl.indexOf('?')));
    const childIwpc = trackedIwpc(child);
    childIwpc.initialize();
    childIwpc.register('GREET', (name) => `hello ${name as string}`);

    const agent = await openPromise;
    await expect(
      agent.invoke<string, string>('GREET', 'world', { timeout: 500 })
    ).resolves.toBe('hello world');
  });

  it('end-to-end: child invokes parent procedure', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    let capturedUrl = '';
    parent.open = vi.fn((url) => {
      capturedUrl = url ?? '';
      return null;
    });

    const openPromise = parentIwpc.open('/child');
    await flush();

    const child = new FakeWindow();
    child.setSearch(capturedUrl.slice(capturedUrl.indexOf('?')));
    const childIwpc = trackedIwpc(child);
    childIwpc.initialize();

    parentIwpc.register('DOUBLE', (n) => (n as number) * 2);
    await openPromise;
    await childIwpc.ready;

    const result = await childIwpc.parentIwpcWindow?.invoke<number, number>(
      'DOUBLE',
      21,
      { timeout: 500 }
    );
    expect(result).toBe(42);
  });

  it('re-acks a reloaded child so the new instance can re-establish its parent agent', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    let capturedUrl = '';
    parent.open = vi.fn((url) => {
      capturedUrl = url ?? '';
      return null;
    });

    // Initial pairing.
    const openPromise = parentIwpc.open('/child');
    await flush();

    const childSearch = capturedUrl.slice(capturedUrl.indexOf('?'));
    const originalChild = new FakeWindow();
    originalChild.setSearch(childSearch);
    const originalChildIwpc = trackedIwpc(originalChild);
    originalChildIwpc.initialize();

    const agent = await openPromise;
    await originalChildIwpc.ready;
    const childWindowId = originalChildIwpc.windowId;

    // Parent registers a procedure; child can call it via its parent agent.
    parentIwpc.register('PING', () => 'pong-1');
    await expect(
      originalChildIwpc.parentIwpcWindow?.invoke<void, string>('PING', undefined, {
        timeout: 500
      })
    ).resolves.toBe('pong-1');

    // Simulate a child-side reload: dispose the old child and spin up a new
    // IwpcWindow on a new FakeWindow with the same query string. The parent
    // remains alive.
    originalChildIwpc.dispose();

    const reloadedChild = new FakeWindow();
    reloadedChild.setSearch(childSearch);
    const reloadedChildIwpc = trackedIwpc(reloadedChild);
    reloadedChildIwpc.initialize();

    await reloadedChildIwpc.ready;
    expect(reloadedChildIwpc.windowId).toBe(childWindowId);
    expect(reloadedChildIwpc.parentWindowId).toBe(parentIwpc.windowId);

    // The parent's existing agent (returned earlier) still points to the same
    // childWindowId and can reach the reloaded child.
    reloadedChildIwpc.register('GREET', (name) => `hi ${name as string}`);
    await expect(
      agent.invoke<string, string>('GREET', 'world', { timeout: 500 })
    ).resolves.toBe('hi world');

    // And the reloaded child can still call the parent.
    parentIwpc.register('PING', () => 'pong-2');
    await expect(
      reloadedChildIwpc.parentIwpcWindow?.invoke<void, string>('PING', undefined, {
        timeout: 500
      })
    ).resolves.toBe('pong-2');
  });

  it('rejects open() when the child never broadcasts NOTIFY_WINDOW_ID', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;
    parent.open = vi.fn(() => null);

    await expect(parentIwpc.open('/child')).rejects.toThrow(/NOTIFY/);
  }, 10000);

  it('produces a relative URL when the parent is on the same origin', async () => {
    const parent = new FakeWindow({ origin: 'https://example.test' });
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    let capturedUrl = '';
    parent.open = vi.fn((url) => {
      capturedUrl = url ?? '';
      return null;
    });

    parentIwpc.open('/some/relative').catch(() => undefined);
    await flush();
    expect(capturedUrl.startsWith('/some/relative')).toBe(true);
    expect(capturedUrl.startsWith('http')).toBe(false);
  });

  it('preserves the noopener feature even when target is overridden', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    let features = '';
    parent.open = vi.fn((_url, _target, feats) => {
      features = feats ?? '';
      return null;
    });

    parentIwpc.open('/child', { target: 'someName' }).catch(() => undefined);
    await flush();
    expect(features).toContain('noopener');
  });

  it('drops noopener if explicitly disabled', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;

    let features = '';
    parent.open = vi.fn((_url, _target, feats) => {
      features = feats ?? '';
      const fake = new FakeWindow();
      return fake;
    });

    parentIwpc.open('/child', { noopener: false }).catch(() => undefined);
    await flush();
    expect(features.split(',')).not.toContain('noopener');
  });

  it('dispose rejects pending open() promises', async () => {
    const parent = new FakeWindow();
    const parentIwpc = trackedIwpc(parent);
    parentIwpc.initialize();
    await parentIwpc.ready;
    parent.open = vi.fn(() => null);

    const pending = parentIwpc.open('/child');
    parentIwpc.dispose();
    await expect(pending).rejects.toThrow(/disposed/i);
  });

  it('child windowId stays stable across initialize calls (idempotent)', async () => {
    const child = new FakeWindow();
    child.setSearch(`${IWPC_WINDOW_ID_QUERY_PARAM}=stable-id`);
    const iwpc = trackedIwpc(child);
    const beforeInit = iwpc.windowId;
    iwpc.initialize();
    iwpc.initialize(); // second call is a no-op
    expect(iwpc.windowId).toBe(beforeInit);
    expect(iwpc.windowId).toBe('stable-id');
  });
});

describe('IwpcWindow (broadcastChannel transport) - cross-mode isolation', () => {
  it('a postMessage-mode parent and a broadcastChannel-mode child do NOT auto-pair', async () => {
    const parent = new FakeWindow();
    const parentIwpc = new IwpcWindow(parent as unknown as Window, {
      transport: 'postMessage'
    });
    live.push(parentIwpc);
    parentIwpc.initialize();
    await parentIwpc.ready;

    const child = new FakeWindow();
    child.setSearch(`${IWPC_WINDOW_ID_QUERY_PARAM}=child-id`);
    const childIwpc = trackedIwpc(child);
    childIwpc.initialize();
    await flush();

    // No postMessage was used → parent has no agent registered for this child.
    parent.open = vi.fn(() => null);
    await expect(parentIwpc.open('/never')).rejects.toBeDefined();
  }, 10000);
});
