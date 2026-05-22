import { afterEach, describe, expect, it, vi } from 'vitest';

import { FakeWindow, flush } from '../test-helpers/fakeWindow';
import { Topic } from '../topic/topic';

import { IWPC_WINDOW_ID_QUERY_PARAM } from './constants';
import { DEFAULT_IWPC_CHANNEL_NAME, IwpcWindow } from './iwpcWindow';
import { IwpcMessage } from './message';

const live: IwpcWindow[] = [];

function tracked(w: IwpcWindow): IwpcWindow {
  live.push(w);
  return w;
}

afterEach(() => {
  while (live.length) live.pop()?.dispose();
});

describe('IwpcOptions.channelName', () => {
  it('defaults to "IWPC" when not provided', () => {
    const w = new FakeWindow();
    const iwpc = tracked(new IwpcWindow(w as unknown as Window));
    iwpc.initialize();
    expect(iwpc.channelName).toBe(DEFAULT_IWPC_CHANNEL_NAME);
    expect(iwpc.channelName).toBe('IWPC');
  });

  it('uses the provided channel name', () => {
    const w = new FakeWindow();
    const iwpc = tracked(
      new IwpcWindow(w as unknown as Window, { channelName: 'myapp:iwpc' })
    );
    iwpc.initialize();
    expect(iwpc.channelName).toBe('myapp:iwpc');
  });

  it('two parents on different channelNames cannot see each other (broadcastChannel transport)', async () => {
    // Parent A on channel "app-a"
    const parentA = new FakeWindow();
    const iwpcA = tracked(
      new IwpcWindow(parentA as unknown as Window, {
        transport: 'broadcastChannel',
        channelName: 'app-a'
      })
    );
    iwpcA.initialize();
    await iwpcA.ready;

    let openedUrlA = '';
    parentA.open = vi.fn((url) => {
      openedUrlA = url ?? '';
      return null;
    });
    const openPromiseA = iwpcA.open('/child');
    openPromiseA.catch(() => undefined);
    await flush();

    // A child for parent A, but constructed against channel "app-b" by
    // mistake — should NOT pair up.
    const childWrong = new FakeWindow();
    childWrong.setSearch(openedUrlA.slice(openedUrlA.indexOf('?')));
    const wrongIwpc = tracked(
      new IwpcWindow(childWrong as unknown as Window, {
        transport: 'broadcastChannel',
        channelName: 'app-b' // <- different channel
      })
    );
    wrongIwpc.initialize();

    await expect(openPromiseA).rejects.toThrow(/NOTIFY/);
  }, 10000);

  it('end-to-end works when both parent and child agree on a custom channelName (broadcastChannel transport)', async () => {
    const parent = new FakeWindow();
    const parentIwpc = tracked(
      new IwpcWindow(parent as unknown as Window, {
        transport: 'broadcastChannel',
        channelName: 'shared-channel'
      })
    );
    parentIwpc.initialize();
    await parentIwpc.ready;

    let openedUrl = '';
    parent.open = vi.fn((url) => {
      openedUrl = url ?? '';
      return null;
    });
    const openPromise = parentIwpc.open('/child');
    await flush();

    const child = new FakeWindow();
    child.setSearch(openedUrl.slice(openedUrl.indexOf('?')));
    const childIwpc = tracked(
      new IwpcWindow(child as unknown as Window, {
        transport: 'broadcastChannel',
        channelName: 'shared-channel'
      })
    );
    childIwpc.initialize();

    childIwpc.register('PING', () => 'pong');
    const agent = await openPromise;
    await expect(agent.invoke('PING', undefined, { timeout: 500 })).resolves.toBe(
      'pong'
    );
  });

  it('invocation does not cross channelName boundaries even when targetWindowId matches', async () => {
    // iwpcA listens on channel-a with windowId="collision".
    const parentA = new FakeWindow();
    parentA.setSearch(`${IWPC_WINDOW_ID_QUERY_PARAM}=collision`);
    const iwpcA = tracked(
      new IwpcWindow(parentA as unknown as Window, {
        transport: 'broadcastChannel',
        channelName: 'channel-a'
      })
    );
    iwpcA.initialize();
    // iwpcA's ready will reject (no parent to ack); that's irrelevant — the
    // INVOKE subscription is wired in initialize() regardless.
    iwpcA.ready.catch(() => undefined);

    const handler = vi.fn(() => 'should-not-fire');
    iwpcA.register('SECRET', handler);

    // Publish an INVOKE on channel-b targeted at windowId="collision". If
    // channelName isolation works, iwpcA on channel-a must not see it.
    const topicB = new Topic<string, IwpcMessage>('channel-b');
    topicB.publish({
      type: 'INVOKE',
      iwpcTaskId: 'task-1',
      processId: 'SECRET',
      targetWindowId: 'collision',
      senderWindowId: 'other',
      args: undefined
    });
    await flush();
    topicB.close();

    expect(handler).not.toHaveBeenCalled();
  });
});
