import { nanoid } from 'nanoid';

import { Topic } from '../topic/topic';

import { IWPC_PROCESS_TIMEOUT } from './constants';
import { Logger } from './Logger';
import { IwpcInvokeMessage, IwpcMessage } from './message';

export type IwpcAgentOptions = {
  debug?: boolean;
};

type InvokeOptions = {
  timeout: number;
};
export class IwpcWindowAgent extends Logger {
  private _options?: IwpcAgentOptions;

  // window
  private _window: Window;
  private _windowId: string;
  private _ownerWindowId: string;
  private _iwpcPromiseMap: Map<string, Promise<unknown>>;
  private _iwpcResolveMap: Map<
    string,
    (value: unknown | PromiseLike<unknown>) => void
  >;
  private _iwpcRejectmap: Map<string, (reason?: unknown) => void>;

  // Subscription
  private _iwpcTopic: Topic<'IWPC', IwpcMessage>;

  constructor(
    window: Window,
    windowId: string,
    ownerWindowId: string,
    options?: IwpcAgentOptions
  ) {
    super(options?.debug === true);
    this._options = options;
    this._window = window;
    this._windowId = windowId;
    this._ownerWindowId = ownerWindowId;
    this._iwpcPromiseMap = new Map();
    this._iwpcResolveMap = new Map();
    this._iwpcRejectmap = new Map();
    this._iwpcTopic = new Topic<'IWPC', IwpcMessage>('IWPC');
    this._iwpcTopic.subscribe(this._returnMessageSubscriber.bind(this));
  }

  get window() {
    return this._window;
  }

  get windowId() {
    return this._windowId;
  }

  public async invoke<Argument = unknown, Return = unknown>(
    processId: string,
    args: Argument,
    options?: InvokeOptions
  ): Promise<Return> {
    const iwpcTaskId = nanoid();
    const returnValue = new Promise<Return>((resolve, reject) => {
      this._iwpcResolveMap.set(
        iwpcTaskId,
        resolve as unknown as (value: unknown | PromiseLike<unknown>) => void
      );
      this._iwpcRejectmap.set(iwpcTaskId, reject);
    });
    this._iwpcPromiseMap.set(iwpcTaskId, returnValue);

    const iwpcInvokeMessage: IwpcInvokeMessage = {
      type: 'INVOKE',
      iwpcTaskId: iwpcTaskId,
      processId: processId,
      targetWindowId: this._windowId,
      senderWindowId: this._ownerWindowId,
      args: args
    };

    setTimeout(() => {
      this._iwpcPromiseMap.get(iwpcTaskId)?.catch(() => {
        this._error('⏱ Procedure call timed out.', iwpcInvokeMessage);
        this._cleanupIwpcMap(iwpcTaskId);
      });
      this._iwpcRejectmap.get(iwpcTaskId)?.();
    }, options?.timeout ?? IWPC_PROCESS_TIMEOUT);

    this._iwpcTopic.publish(iwpcInvokeMessage);
    this._log('↪ Requested a procedural call.', iwpcInvokeMessage);

    return returnValue;
  }

  private _returnMessageSubscriber(message: IwpcMessage) {
    if (message.targetWindowId !== this._ownerWindowId) {
      return;
    }
    if (message.type !== 'RETURN') {
      return;
    }
    this._iwpcResolveMap.get(message.iwpcTaskId)?.(message.returnValue);
    this._log('↩ Returned the results of the procedure call.', message);
    this._cleanupIwpcMap(message.iwpcTaskId);
  }

  private _cleanupIwpcMap(iwpcTaskId: string) {
    this._iwpcPromiseMap.delete(iwpcTaskId);
    this._iwpcResolveMap.delete(iwpcTaskId);
    this._iwpcRejectmap.delete(iwpcTaskId);
    this._log(
      '🗑 The task has been completed and the items associated with the process have been deleted.',
      `taskId: ${iwpcTaskId}`
    );
  }
}
