import { nanoid } from 'nanoid';

import { Topic } from '../topic/topic';

import { IWPC_PROCESS_TIMEOUT } from './constants';
import { IwpcInvokeMessage, IwpcMessage } from './iwpcMessage';

export class IwpcWindowAgent {
  // window
  private _window: Window;
  private _windowId: string;
  private _ownerWindowId: string;
  private _iwpcResolveMap: Map<
    string,
    (value: unknown | PromiseLike<unknown>) => void
  >;
  private _iwpcRejectmap: Map<string, (reason?: unknown) => void>;

  // Subscription
  private _iwpcTopic: Topic<'IWPC', IwpcMessage>;

  constructor(window: Window, windowId: string, ownerWindowId: string) {
    this._window = window;
    this._windowId = windowId;
    this._ownerWindowId = ownerWindowId;
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
    args: Argument
  ): Promise<Return> {
    const iwpcTaskId = nanoid();
    const returnValue = new Promise<Return>((resolve, reject) => {
      this._iwpcResolveMap.set(
        iwpcTaskId,
        resolve as unknown as (value: unknown | PromiseLike<unknown>) => void
      );
      this._iwpcRejectmap.set(iwpcTaskId, reject);
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

    setTimeout(() => {
      this._iwpcRejectmap.get(iwpcTaskId)?.();
      this._cleanupIwpcMap(iwpcTaskId);
    }, IWPC_PROCESS_TIMEOUT);

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
    this._cleanupIwpcMap(message.iwpcTaskId);
  }

  private _cleanupIwpcMap(iwpcTaskId: string) {
    this._iwpcResolveMap.delete(iwpcTaskId);
    this._iwpcRejectmap.delete(iwpcTaskId);
  }
}
