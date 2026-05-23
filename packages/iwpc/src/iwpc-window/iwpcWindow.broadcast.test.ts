import { afterEach, describe, expect, it, vi } from 'vitest';

import { FakeWindow, flush } from '../test-helpers/fakeWindow';

import { IwpcDisposedError } from './errors';
import { IwpcWindow } from './iwpcWindow';

const live: IwpcWindow[] = [];

function makeWindow(channelName?: string): IwpcWindow {
  const w = new IwpcWindow(new FakeWindow() as unknown as Window, {
    transport: 'broadcastChannel',
    channelName
  });
  live.push(w);
  w.initialize();
  return w;
}

afterEach(() => {
  while (live.length) live.pop()?.dispose();
});

describe('IwpcWindow#broadcast', () => {
  it('fires the registered handler on every other window on the channel', async () => {
    const sender = makeWindow();
    const a = makeWindow();
    const b = makeWindow();

    const handlerA = vi.fn();
    const handlerB = vi.fn();
    a.register('PING', handlerA);
    b.register('PING', handlerB);

    sender.broadcast('PING', { value: 42 });
    await flush();

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerA).toHaveBeenCalledWith({ value: 42 });
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledWith({ value: 42 });
  });

  it('does not deliver to the sender even if the sender registered the same procedure', async () => {
    const sender = makeWindow();
    const senderHandler = vi.fn();
    sender.register('PING', senderHandler);

    sender.broadcast('PING');
    await flush();

    expect(senderHandler).not.toHaveBeenCalled();
  });

  it('is silent when no other window has the procedure registered', async () => {
    const sender = makeWindow();
    const other = makeWindow();
    other.register('UNRELATED', vi.fn());

    // No handler for PING anywhere — must not throw.
    expect(() => sender.broadcast('PING')).not.toThrow();
    await flush();
  });

  it('does not cross channelName boundaries', async () => {
    const sender = makeWindow('channel-a');
    const onA = makeWindow('channel-a');
    const onB = makeWindow('channel-b');

    const handlerA = vi.fn();
    const handlerB = vi.fn();
    onA.register('PING', handlerA);
    onB.register('PING', handlerB);

    sender.broadcast('PING');
    await flush();

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('swallows recipient errors so other recipients still fire', async () => {
    const sender = makeWindow();
    const throwingPeer = makeWindow();
    const okPeer = makeWindow();

    throwingPeer.register('PING', () => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    okPeer.register('PING', ok);

    sender.broadcast('PING');
    await flush();

    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('throws when called after dispose()', () => {
    const w = makeWindow();
    w.dispose();
    expect(() => w.broadcast('PING')).toThrow(IwpcDisposedError);
  });

  it('does not generate RETURN traffic for the sender to chase', async () => {
    // Subscribe a generic listener on a sibling Topic-like consumer to
    // confirm only the BROADCAST envelope is emitted — no RETURN follows.
    const sender = makeWindow();
    const peer = makeWindow();
    peer.register('PING', () => 'should be ignored');

    const seen: string[] = [];
    const bc = new BroadcastChannel('IWPC');
    bc.onmessage = (e: MessageEvent) => {
      const data = e.data as { type?: string } | null;
      if (data?.type) seen.push(data.type);
    };

    sender.broadcast('PING');
    await flush();

    bc.close();

    expect(seen).toContain('BROADCAST');
    expect(seen).not.toContain('RETURN');
  });
});
