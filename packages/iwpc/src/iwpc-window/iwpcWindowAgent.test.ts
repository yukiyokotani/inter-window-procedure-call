import { afterEach, describe, expect, it, vi } from 'vitest';

import { Topic } from '../topic/topic';

import { IwpcWindowAgent } from './iwpcWindowAgent';
import {
  IwpcInvokeMessage,
  IwpcMessage,
  IwpcReturnMessage
} from './message';

const topics: Topic<'IWPC', IwpcMessage>[] = [];
const agents: IwpcWindowAgent[] = [];

function makeTopic(): Topic<'IWPC', IwpcMessage> {
  const t = new Topic<'IWPC', IwpcMessage>('IWPC');
  topics.push(t);
  return t;
}

function makeAgent(opts: {
  ownerWindowId: string;
  targetWindowId: string;
  topic: Topic<'IWPC', IwpcMessage>;
}): IwpcWindowAgent {
  const agent = new IwpcWindowAgent(
    null,
    opts.targetWindowId,
    opts.ownerWindowId,
    opts.topic
  );
  agents.push(agent);
  return agent;
}

afterEach(() => {
  while (agents.length) agents.pop()?.dispose();
  while (topics.length) topics.pop()?.close();
});

async function tick(times = 2): Promise<void> {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

describe('IwpcWindowAgent.invoke', () => {
  it('publishes an INVOKE message addressed to the target window and resolves on RETURN', async () => {
    const callerTopic = makeTopic();
    const calleeTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    let captured: IwpcInvokeMessage | undefined;
    calleeTopic.subscribe((msg) => {
      if (msg.type !== 'INVOKE') return;
      captured = msg;
      const ret: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: msg.iwpcTaskId,
        processId: msg.processId,
        targetWindowId: msg.senderWindowId,
        senderWindowId: msg.targetWindowId,
        returnValue: 'pong'
      };
      calleeTopic.publish(ret);
    });

    const result = await agent.invoke<string, string>('PING', 'hi');

    expect(result).toBe('pong');
    expect(captured).toBeDefined();
    expect(captured?.processId).toBe('PING');
    expect(captured?.args).toBe('hi');
    expect(captured?.targetWindowId).toBe('callee');
    expect(captured?.senderWindowId).toBe('caller');
    expect(typeof captured?.iwpcTaskId).toBe('string');
  });

  it('ignores RETURN messages addressed to a different owner', async () => {
    const callerTopic = makeTopic();
    const peerTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    callerTopic.subscribe((msg) => {
      if (msg.type !== 'INVOKE') return;
      // Send a RETURN aimed at someone else; should be ignored.
      const wrong: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: msg.iwpcTaskId,
        processId: msg.processId,
        targetWindowId: 'somebody-else',
        senderWindowId: msg.targetWindowId,
        returnValue: 'should-be-dropped'
      };
      peerTopic.publish(wrong);
    });

    await expect(
      agent.invoke('PING', undefined, { timeout: 60 })
    ).rejects.toThrow(/timed out/i);
  });

  it('ignores RETURN messages from a window that is not the agent target', async () => {
    const callerTopic = makeTopic();
    const peerTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    callerTopic.subscribe((msg) => {
      if (msg.type !== 'INVOKE') return;
      const wrong: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: msg.iwpcTaskId,
        processId: msg.processId,
        targetWindowId: msg.senderWindowId,
        senderWindowId: 'some-other-window',
        returnValue: 'wrong-source'
      };
      peerTopic.publish(wrong);
    });

    await expect(
      agent.invoke('PING', undefined, { timeout: 60 })
    ).rejects.toThrow(/timed out/i);
  });

  it('rejects with an Error when the call times out', async () => {
    const callerTopic = makeTopic();
    makeTopic(); // peer that never replies
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    const start = Date.now();
    await expect(
      agent.invoke('NEVER', undefined, { timeout: 50 })
    ).rejects.toThrowError(/IWPC procedure call timed out: NEVER/);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  it('propagates remote errors through the return promise', async () => {
    const callerTopic = makeTopic();
    const calleeTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    calleeTopic.subscribe((msg) => {
      if (msg.type !== 'INVOKE') return;
      const ret: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: msg.iwpcTaskId,
        processId: msg.processId,
        targetWindowId: msg.senderWindowId,
        senderWindowId: msg.targetWindowId,
        returnValue: undefined,
        error: { name: 'CustomFailure', message: 'kaboom' }
      };
      calleeTopic.publish(ret);
    });

    const err = await agent.invoke('BAD').then(
      () => null,
      (e) => e
    );
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe('CustomFailure');
    expect((err as Error).message).toBe('kaboom');
  });

  it('does not resolve when a stray RETURN with an unknown taskId arrives', async () => {
    const callerTopic = makeTopic();
    const calleeTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    const pending = agent.invoke('PING', undefined, { timeout: 80 });
    await tick();

    const stray: IwpcReturnMessage = {
      type: 'RETURN',
      iwpcTaskId: 'never-issued',
      processId: 'PING',
      targetWindowId: 'caller',
      senderWindowId: 'callee',
      returnValue: 'should-not-resolve'
    };
    calleeTopic.publish(stray);

    await expect(pending).rejects.toThrow(/timed out/i);
  });

  it('rejects pending invocations when the agent is disposed', async () => {
    const callerTopic = makeTopic();
    makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    const pending = agent.invoke('PING', undefined, { timeout: 5000 });
    agent.dispose();
    await expect(pending).rejects.toThrow(/disposed/i);
  });

  it('refuses to invoke after dispose', async () => {
    const callerTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });
    agent.dispose();
    await expect(agent.invoke('PING')).rejects.toThrow(/disposed/i);
  });

  it('dispose is idempotent', () => {
    const callerTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });
    expect(() => {
      agent.dispose();
      agent.dispose();
    }).not.toThrow();
  });

  it('emits a new iwpcTaskId for every invocation', async () => {
    const callerTopic = makeTopic();
    const calleeTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    const seenIds: string[] = [];
    calleeTopic.subscribe((msg) => {
      if (msg.type !== 'INVOKE') return;
      seenIds.push(msg.iwpcTaskId);
      const ret: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: msg.iwpcTaskId,
        processId: msg.processId,
        targetWindowId: msg.senderWindowId,
        senderWindowId: msg.targetWindowId,
        returnValue: msg.iwpcTaskId
      };
      calleeTopic.publish(ret);
    });

    const [a, b] = await Promise.all([
      agent.invoke<undefined, string>('PING'),
      agent.invoke<undefined, string>('PING')
    ]);

    expect(a).not.toBe(b);
    expect(new Set(seenIds).size).toBe(2);
  });

  it('exposes the target window id via the windowId getter', () => {
    const t = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'target-xyz',
      topic: t
    });
    expect(agent.windowId).toBe('target-xyz');
  });

  it('window getter returns the value passed in (null in BC mode)', () => {
    const t = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: t
    });
    expect(agent.window).toBeNull();
  });

  it('does not log errors when a procedure call resolves before the timeout', async () => {
    const callerTopic = makeTopic();
    const calleeTopic = makeTopic();
    const agent = makeAgent({
      ownerWindowId: 'caller',
      targetWindowId: 'callee',
      topic: callerTopic
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    await agent.invoke('PING', undefined, { timeout: 50 });
    // Wait beyond the timeout — if the timer was not cleared we'd see a log.
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
