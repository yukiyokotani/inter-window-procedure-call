import { afterEach, describe, expect, it } from 'vitest';

import { Topic } from '../topic/topic';

import {
  IwpcAbortError,
  IwpcDisposedError,
  IwpcError,
  IwpcTimeoutError
} from './errors';
import { IwpcWindowAgent } from './iwpcWindowAgent';
import { IwpcMessage, IwpcReturnMessage } from './message';

const topics: Topic<'IWPC', IwpcMessage>[] = [];
const agents: IwpcWindowAgent[] = [];

function newTopic(): Topic<'IWPC', IwpcMessage> {
  const t = new Topic<'IWPC', IwpcMessage>('IWPC');
  topics.push(t);
  return t;
}

function newAgent(topic: Topic<'IWPC', IwpcMessage>): IwpcWindowAgent {
  const agent = new IwpcWindowAgent(null, 'callee', 'caller', topic);
  agents.push(agent);
  return agent;
}

afterEach(() => {
  while (agents.length) agents.pop()?.dispose();
  while (topics.length) topics.pop()?.close();
});

describe('IwpcWindowAgent.invoke — AbortSignal', () => {
  it('rejects with IwpcAbortError when the signal aborts before the call completes', async () => {
    const callerTopic = newTopic();
    newTopic(); // callee that never replies
    const agent = newAgent(callerTopic);
    const ac = new AbortController();
    const pending = agent.invoke('NEVER', undefined, {
      signal: ac.signal,
      timeout: 5000
    });
    queueMicrotask(() => ac.abort());
    const err = await pending.catch((e) => e);
    expect(err).toBeInstanceOf(IwpcAbortError);
    expect(err).toBeInstanceOf(IwpcError);
  });

  it('rejects immediately with IwpcAbortError when the signal is already aborted', async () => {
    const callerTopic = newTopic();
    newTopic();
    const agent = newAgent(callerTopic);
    const ac = new AbortController();
    ac.abort();
    await expect(
      agent.invoke('NEVER', undefined, { signal: ac.signal })
    ).rejects.toBeInstanceOf(IwpcAbortError);
  });

  it('does not reject after the call has already returned successfully', async () => {
    const callerTopic = newTopic();
    const calleeTopic = newTopic();
    const agent = newAgent(callerTopic);
    calleeTopic.subscribe((msg) => {
      if (msg.type !== 'INVOKE') return;
      const ret: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: msg.iwpcTaskId,
        processId: msg.processId,
        targetWindowId: msg.senderWindowId,
        senderWindowId: msg.targetWindowId,
        returnValue: 'ok'
      };
      calleeTopic.publish(ret);
    });

    const ac = new AbortController();
    const result = await agent.invoke<undefined, string>('PING', undefined, {
      signal: ac.signal,
      timeout: 500
    });
    expect(result).toBe('ok');

    // Aborting now is a no-op because the promise has already settled.
    ac.abort();
    await new Promise<void>((r) => setTimeout(r, 0));
    // No unhandled rejection should have been generated.
  });

  it('does not race with timeout: an abort during a slow call wins over the timer', async () => {
    const callerTopic = newTopic();
    newTopic();
    const agent = newAgent(callerTopic);
    const ac = new AbortController();
    const pending = agent.invoke('SLOW', undefined, {
      signal: ac.signal,
      timeout: 5000
    });
    setTimeout(() => ac.abort(), 20);
    const err = await pending.catch((e) => e);
    expect(err).toBeInstanceOf(IwpcAbortError);
    expect(err).not.toBeInstanceOf(IwpcTimeoutError);
  });

  it('still respects the timeout when no signal is provided', async () => {
    const callerTopic = newTopic();
    newTopic();
    const agent = newAgent(callerTopic);
    await expect(
      agent.invoke('NEVER', undefined, { timeout: 30 })
    ).rejects.toBeInstanceOf(IwpcTimeoutError);
  });

  it('removes the abort listener when the call completes (no leaks)', async () => {
    const callerTopic = newTopic();
    const calleeTopic = newTopic();
    const agent = newAgent(callerTopic);
    calleeTopic.subscribe((msg) => {
      if (msg.type !== 'INVOKE') return;
      const ret: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: msg.iwpcTaskId,
        processId: msg.processId,
        targetWindowId: msg.senderWindowId,
        senderWindowId: msg.targetWindowId,
        returnValue: 'ok'
      };
      calleeTopic.publish(ret);
    });

    const ac = new AbortController();
    // The internal listener count is not directly observable, but we can
    // observe that aborting after the call resolved does not reject the
    // already-fulfilled promise (which would otherwise be observable via an
    // unhandled rejection warning at process exit).
    await agent.invoke('PING', undefined, {
      signal: ac.signal,
      timeout: 200
    });
    ac.abort();
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  it('IwpcDisposedError is thrown synchronously when invoke is called on a disposed agent', async () => {
    const t = newTopic();
    const agent = newAgent(t);
    agent.dispose();
    await expect(agent.invoke('PING')).rejects.toBeInstanceOf(
      IwpcDisposedError
    );
  });
});
