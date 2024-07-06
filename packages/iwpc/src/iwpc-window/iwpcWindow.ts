import { nanoid } from 'nanoid';

import { Topic } from '../topic/topic';

import { INITIALIZATION_TIMEOUT } from './constants';
import {
  IwpcMessage,
  IwpcReturnMessage,
  NotifyWindowIdMessage,
  RecievedWindowIdMessage
} from './message';
import { IwpcWindowAgent } from './IwpcWindowAgent';
import { Logger } from './Logger';
import { messageEventSourceIsWindow } from './utils';

export type IwpcOptions = {
  debug?: boolean;
};

type ChildWindowOptions = {
  target?: string | undefined;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
};

export class IwpcWindow extends Logger {
  private _options?: IwpcOptions;

  // window
  private _window: Window;
  private _windowId: string;
  private _parentWindow: Window | null;
  private _parentWindowId: string | undefined;
  private _parentIwpcWindow: IwpcWindowAgent | undefined;
  private _childWindowIdMap: Map<string, Window> | undefined;
  private _childWindowResolveMap:
    | Map<
        Window,
        (value: IwpcWindowAgent | PromiseLike<IwpcWindowAgent>) => void
      >
    | undefined;
  private _childWindowRejectMap:
    | Map<Window, (reason?: unknown) => void>
    | undefined;

  // Subscription
  private _iwpcTopic: Topic<'IWPC', IwpcMessage>;

  // Iwpc
  private _iwpcRegisteredProcessMap:
    | Map<string, (args: unknown) => unknown>
    | undefined;

  // status
  private _ready: Promise<boolean>;
  private _resolveReady?: (
    value: boolean | PromiseLike<boolean>
  ) => void | undefined;
  private _rejectReady?: (reason?: unknown) => void | undefined;

  constructor(window: Window, options?: IwpcOptions) {
    super(options?.debug === true);
    this._options = options;
    this._window = window;
    this._windowId = nanoid();
    this._parentWindow = window.opener;
    this._childWindowIdMap = new Map();
    this._childWindowResolveMap = new Map();
    this._childWindowRejectMap = new Map();
    this._iwpcRegisteredProcessMap = new Map();
    this._ready = new Promise<boolean>((resolve, reject) => {
      this._resolveReady = resolve;
      this._rejectReady = reject;
    });
    this._iwpcTopic = new Topic<'IWPC', IwpcMessage>('IWPC');
    this._log('⚙️ Constructor executed,', `This windowId: ${this._windowId}`);
  }

  get window() {
    return this._window;
  }

  get windowId() {
    return this._windowId;
  }

  get parentIwpcWindow() {
    return this._parentIwpcWindow;
  }

  get parentWindowId() {
    return this._parentWindowId;
  }

  get ready() {
    return this._ready;
  }

  public async initialize() {
    // Subscribe Iwpc Topic
    this._iwpcTopic.subscribe(this._invokeMessageSubscriber.bind(this));

    // Add EventListener
    this.window.addEventListener(
      'message',
      this._notifyWindowIdMessageHandler.bind(this)
    );
    this.window.addEventListener(
      'message',
      this._receivedWindowIdMessageHandler.bind(this)
    );
    this._debug('⚙️ EventListeners have been registered.');

    if (this._parentWindow === null) {
      this._warn(
        '⚠ Initialization as an IwpcWindow was skipped because the parent window does not exist.'
      );
      this._resolveReady?.(true);
      return;
    }

    setTimeout(() => {
      this._ready.catch(() => {
        this._error(
          '🆔⏱ The process timed out without receiving a message of ID receipt from the parent window.'
        );
      });
      this._rejectReady?.();
    }, INITIALIZATION_TIMEOUT);

    const notifyIdMessage: NotifyWindowIdMessage = {
      type: 'NOTIFIY_WINDOW_ID',
      myWindowId: this._windowId
    };
    this._parentWindow?.postMessage(
      notifyIdMessage,
      this._window.location.origin
    );
    this._log('🆔📮 ID notification message sent to parentwindow.');
  }

  public async register(
    processId: string,
    callback: (args: unknown) => unknown
  ) {
    this._iwpcRegisteredProcessMap?.set(processId, callback);
  }

  public async unregister(processId: string) {
    this._iwpcRegisteredProcessMap?.delete(processId);
  }

  public async open(
    path: string,
    options?: ChildWindowOptions
  ): Promise<IwpcWindowAgent> {
    await this._ready;
    const target = options?.target ?? '_blank';
    const features = this._createChildWindowFeatures(options);

    let childWindow: Window | null | undefined;
    let rejectChildWindowInitialization: (reason?: unknown) => void;

    const iwpcChildWindow = new Promise<IwpcWindowAgent>((resolve, reject) => {
      rejectChildWindowInitialization = reject;
      childWindow = window.open(path, target, features);
      if (childWindow === null) {
        throw new Error('Could not obtain a reference to the child window.');
      }
      this._childWindowResolveMap?.set(childWindow, resolve);
      this._childWindowRejectMap?.set(childWindow, reject);
    });

    this.window.setTimeout(() => {
      rejectChildWindowInitialization?.(
        'Notification of id from child window timed out. The child window is closed because communication is not available.'
      );
    }, INITIALIZATION_TIMEOUT);

    return iwpcChildWindow;
  }

  public dispose() {
    this._iwpcTopic?.close();
    this._childWindowIdMap = undefined;
    this._childWindowResolveMap = undefined;
    this._childWindowRejectMap = undefined;
    this._iwpcRegisteredProcessMap = undefined;

    this.window.removeEventListener(
      'message',
      this._notifyWindowIdMessageHandler.bind(this)
    );
    this.window.removeEventListener(
      'message',
      this._receivedWindowIdMessageHandler.bind(this)
    );
    this._log(`🗑 Disposed iwpcWindow: ${this._windowId}`);
  }

  public close() {
    this.dispose();
    this._window.close();
  }

  private _createChildWindowFeatures(options?: ChildWindowOptions) {
    const featureLeft = `left=${options?.left ?? 0}`;
    const featureTop = `top=${options?.top ?? 0}`;
    const featureWidth = `width=${options?.width ?? 800}`;
    const featureHeight = `height=${options?.height ?? 600}`;
    const features = [
      featureLeft,
      featureTop,
      featureWidth,
      featureHeight,
      'popup'
    ].join(',');
    return features;
  }

  private _notifyWindowIdMessageHandler(
    message: MessageEvent<NotifyWindowIdMessage>
  ) {
    if (message.data.type !== 'NOTIFIY_WINDOW_ID') {
      return;
    }
    if (!message.source || !messageEventSourceIsWindow(message.source)) {
      this._debug(
        '🆔📬 A message of ID notification is received from the child window, but the message is ignored because the message source is not a window.'
      );
      return;
    }
    if (message.source === this.window) {
      this._debug(
        '🆔📬 A message of ID notification is received from the child window, but the message is ignored because the destination of the message is not this window.'
      );
      return;
    }
    this._log('🆔📬 ID notification received from child window.');
    const childWindowId = message.data.myWindowId;
    const childWindow = message.source;
    this._childWindowIdMap?.set(childWindowId, childWindow);

    const receivedIdMessage: RecievedWindowIdMessage = {
      type: 'RECEIVED_WINDOW_ID',
      yourWindowId: childWindowId,
      myWindowId: this._windowId
    };
    message.source.postMessage(receivedIdMessage, this._window.location.origin);
    const iwpcWindow = new IwpcWindowAgent(
      childWindow,
      childWindowId,
      this._windowId,
      { debug: this._options?.debug }
    );
    this._childWindowResolveMap?.get(childWindow)?.(iwpcWindow);
    this._log('🆔📮 Message of ID receipt sent to child window.');
  }

  private _receivedWindowIdMessageHandler(
    message: MessageEvent<RecievedWindowIdMessage>
  ) {
    if (message.data.type !== 'RECEIVED_WINDOW_ID') {
      return;
    }
    if (!message.source || !messageEventSourceIsWindow(message.source)) {
      this._debug(
        '🆔📬 A message of ID receipt is received from the parent window, but the message is ignored because the message source is not a window.'
      );
      return;
    }
    if (message.source === this._window) {
      this._debug(
        '🆔📬 A message of ID receipt is received from the parent window, but the message is ignored because the destination of the message is not this window.'
      );
      return;
    }
    this._log(
      '🆔📬 Confirmed that the parent window has successfully received the ID of this window.'
    );
    this._parentWindowId = message.data.myWindowId;
    this._parentIwpcWindow = new IwpcWindowAgent(
      message.source,
      this._parentWindowId,
      this._windowId,
      { debug: this._options?.debug }
    );
    this._resolveReady?.(true);
    this._log("👾 The parent window's agent is now ready.");
  }

  private _invokeMessageSubscriber(message: IwpcMessage) {
    if (message.targetWindowId !== this._windowId) {
      return;
    }
    if (message.type !== 'INVOKE') {
      return;
    }
    this._log('↪ Received a message of procedural call request.', message);
    const procedure = this._iwpcRegisteredProcessMap?.get(message.processId);
    if (procedure === undefined) {
      this._warn(
        '⚠ The requested procedure call is not registered.',
        `processId: ${message.processId}`,
        `taskId: ${message.iwpcTaskId}`,
        `requester: ${message.senderWindowId}`
      );
    }
    const returnValue = procedure?.(message.args);
    const iwpcReturnMessage: IwpcReturnMessage = {
      type: 'RETURN',
      iwpcTaskId: message.iwpcTaskId,
      processId: message.processId,
      targetWindowId: message.senderWindowId,
      senderWindowId: this._windowId,
      returnValue: returnValue
    };
    this._iwpcTopic.publish(iwpcReturnMessage);
    this._log(
      '↩ Sent a message of the result of the procedure call.',
      iwpcReturnMessage
    );
  }
}
