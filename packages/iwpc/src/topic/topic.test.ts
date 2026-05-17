import { afterEach, describe, expect, it, vi } from 'vitest';

import { Topic } from './topic';

const channels: Topic<string, unknown>[] = [];

function makeTopic<T>(name: string): Topic<string, T> {
  const t = new Topic<string, T>(name);
  channels.push(t as Topic<string, unknown>);
  return t;
}

afterEach(() => {
  while (channels.length > 0) {
    channels.pop()?.close();
  }
});

describe('Topic', () => {
  it('exposes the channel name', () => {
    const topic = makeTopic<unknown>('test:name');
    expect(topic.name).toBe('test:name');
  });

  it('delivers messages from one Topic instance to another with the same name', async () => {
    const sender = makeTopic<{ value: number }>('test:cross-instance-delivery');
    const receiver = makeTopic<{ value: number }>(
      'test:cross-instance-delivery'
    );

    const received: Array<{ value: number }> = [];
    receiver.subscribe((m) => received.push(m));

    sender.publish({ value: 42 });
    await flushChannel();

    expect(received).toEqual([{ value: 42 }]);
  });

  it('does not deliver a message back to the same Topic instance that published it', async () => {
    const topic = makeTopic<string>('test:no-loopback');
    const seen: string[] = [];
    topic.subscribe((m) => seen.push(m));

    topic.publish('hello');
    await flushChannel();

    expect(seen).toEqual([]);
  });

  it('fans out delivery to every subscriber', async () => {
    const sender = makeTopic<number>('test:fanout');
    const receiver = makeTopic<number>('test:fanout');
    const a = vi.fn();
    const b = vi.fn();
    receiver.subscribe(a);
    receiver.subscribe(b);

    sender.publish(1);
    await flushChannel();

    expect(a).toHaveBeenCalledWith(1);
    expect(b).toHaveBeenCalledWith(1);
  });

  it('stops calling a subscriber after it is unsubscribed', async () => {
    const sender = makeTopic<number>('test:unsubscribe');
    const receiver = makeTopic<number>('test:unsubscribe');
    const cb = vi.fn();
    const sub = receiver.subscribe(cb);

    sender.publish(1);
    await flushChannel();
    expect(cb).toHaveBeenCalledTimes(1);

    sub.unsubscribe();
    sender.publish(2);
    await flushChannel();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('continues delivery to remaining subscribers when one throws', async () => {
    const sender = makeTopic<number>('test:throwing-subscriber');
    const receiver = makeTopic<number>('test:throwing-subscriber');
    const ok = vi.fn();
    receiver.subscribe(() => {
      throw new Error('boom');
    });
    receiver.subscribe(ok);

    sender.publish(7);
    await flushChannel();

    expect(ok).toHaveBeenCalledWith(7);
  });

  it('publish() after close() is a no-op rather than throwing', async () => {
    const sender = makeTopic<number>('test:publish-after-close');
    const receiver = makeTopic<number>('test:publish-after-close');
    const cb = vi.fn();
    receiver.subscribe(cb);

    sender.close();
    expect(() => sender.publish(1)).not.toThrow();
    await flushChannel();
    expect(cb).not.toHaveBeenCalled();
  });

  it('close() drops every subscriber and is idempotent', async () => {
    const sender = makeTopic<number>('test:close-idempotent');
    const receiver = makeTopic<number>('test:close-idempotent');
    const cb = vi.fn();
    receiver.subscribe(cb);

    receiver.close();
    receiver.close();
    sender.publish(1);
    await flushChannel();

    expect(cb).not.toHaveBeenCalled();
  });

  it('does not deliver a message that arrived before subscribe()', async () => {
    const sender = makeTopic<number>('test:late-subscriber');
    const receiver = makeTopic<number>('test:late-subscriber');

    sender.publish(1);
    await flushChannel();

    const cb = vi.fn();
    receiver.subscribe(cb);
    await flushChannel();

    expect(cb).not.toHaveBeenCalled();
  });
});

async function flushChannel(): Promise<void> {
  // BroadcastChannel delivery happens via the event loop. Two microtask
  // turns plus a macrotask is enough in practice.
  await new Promise<void>((r) => setTimeout(r, 0));
}
