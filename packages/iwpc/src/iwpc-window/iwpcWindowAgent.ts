import { nanoid } from 'nanoid';

import { Subscription } from '../topic/subscription';
import { Topic } from '../topic/topic';

import { IWPC_PROCESS_TIMEOUT } from './constants';
import { Logger } from './logger';
import { IwpcInvokeMessage, IwpcMessage } from './message';

export type IwpcAgentOptions = {
  debug?: boolean;
};

type InvokeOptions = {
  timeout?: number;
};

type PendingInvocation = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class IwpcWindowAgent extends Logger {
  // window
  private _window: Window | null;
  private _windowId: string;
  private _ownerWindowId: string;

  // Subscription
  private _iwpcTopic: Topic<'IWPC', IwpcMessage>;
  private _iwpcSubscription: Subscription;

  // Pending invocations
  private _pending: Map<string, PendingInvocation>;

  // Status
  private _disposed: boolean;

  constructor(
    window: Window | null,
    windowId: string,
    ownerWindowId: string,
    iwpcTopic: Topic<'IWPC', IwpcMessage>,
    options?: IwpcAgentOptions
  ) {
    super(options?.debug === true);
    this._window = window;
    this._windowId = windowId;
    this._ownerWindowId = ownerWindowId;
    this._iwpcTopic = iwpcTopic;
    this._pending = new Map();
    this._disposed = false;
    this._iwpcSubscription = this._iwpcTopic.subscribe(
      this._returnMessageSubscriber.bind(this)
    );
  }

  get window() {
    return this._window;
  }

  get windowId() {
    return this._windowId;
  }

  public async invoke<Argument = unknown, Return = unknown>(
    processId: string,
    args?: Argument,
    options?: InvokeOptions
  ): Promise<Return> {
    if (this._disposed) {
      throw new Error('IwpcWindowAgent has been disposed.');
    }
    const iwpcTaskId = nanoid();
    const timeoutMs = options?.timeout ?? IWPC_PROCESS_TIMEOUT;

    const returnValue = new Promise<Return>((resolve, reject) => {
      const timer = setTimeout(() => {
        const entry = this._pending.get(iwpcTaskId);
        if (!entry) return;
        this._pending.delete(iwpcTaskId);
        this._error(
          '⏱ Procedure call timed out.',
          `processId: ${processId}`,
          `taskId: ${iwpcTaskId}`
        );
        entry.reject(
          new Error(`IWPC procedure call timed out: ${processId}`)
        );
      }, timeoutMs);

      this._pending.set(iwpcTaskId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer
      });
    });

    const iwpcInvokeMessage: IwpcInvokeMessage = {
      type: 'INVOKE',
      iwpcTaskId: iwpcTaskId,
      processId: processId,
      targetWindowId: this._windowId,
      senderWindowId: this._ownerWindowId,
      args: args
    };

    this._iwpcTopic.publish(iwpcInvokeMessage);
    this._log('↪ Requested a procedural call.', iwpcInvokeMessage);

    return returnValue;
  }

  public dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._iwpcSubscription.unsubscribe();
    for (const [, entry] of this._pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('IwpcWindowAgent disposed.'));
    }
    this._pending.clear();
  }

  private _returnMessageSubscriber(message: IwpcMessage) {
    if (message.type !== 'RETURN') return;
    if (message.targetWindowId !== this._ownerWindowId) return;
    if (message.senderWindowId !== this._windowId) return;
    const entry = this._pending.get(message.iwpcTaskId);
    if (!entry) return;
    this._pending.delete(message.iwpcTaskId);
    clearTimeout(entry.timer);
    if (message.error) {
      const err = new Error(message.error.message);
      err.name = message.error.name;
      entry.reject(err);
      this._log('↩ Procedure call returned an error.', message);
      return;
    }
    entry.resolve(message.returnValue);
    this._log('↩ Returned the results of the procedure call.', message);
  }
}
