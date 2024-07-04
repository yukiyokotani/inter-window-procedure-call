import { nanoid } from 'nanoid';

import { Topic } from '../topic/topic';

import { INITIALIZATION_TIMEOUT } from './constants';
import {
  IwpcMessage,
  IwpcReturnMessage,
  NotifyWindowId,
  RecievedWindowId
} from './iwpcMessage';
import { IwpcWindowAgent } from './iwpcWindowAgent';
import { messageEventSourceIsWindow } from './util';

type ChildWindowOption = {
  target?: string | undefined;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
};

export class IwpcWindow {
  // window
  private _window: Window;
  private _windowId: string;
  private _parentWindow: Window | null;
  private _parentWindowId: string | undefined;
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

  constructor(window: Window) {
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
    this._iwpcTopic.subscribe(this._iwpcMessageSubscriber.bind(this));
    this._initialize();
  }

  get window() {
    return this._window;
  }

  get windowId() {
    return this._windowId;
  }

  get parentWindowId() {
    return this._parentWindowId;
  }

  get ready() {
    return this._ready;
  }

  public async register(
    processId: string,
    callback: (args: unknown) => unknown
  ) {
    this._iwpcRegisteredProcessMap?.set(processId, callback);
  }

  public async open(
    path: string,
    options?: ChildWindowOption
  ): Promise<IwpcWindowAgent> {
    const target = options?.target ?? '_blank';
    const features = this._createChildWindowFeatures(options);

    let rejectChildWindowInitialization: (reason?: unknown) => void;

    const iwpcChildWindow = new Promise<IwpcWindowAgent>((resolve, reject) => {
      rejectChildWindowInitialization = reject;
      const childWindow = window.open(path, target, features);
      if (childWindow === null) {
        throw new Error('Could not obtain a reference to the child window.');
      }
      this._childWindowResolveMap?.set(childWindow, resolve);
      this._childWindowRejectMap?.set(childWindow, reject);
    });

    this.window.setTimeout(() => {
      rejectChildWindowInitialization?.(
        'Request for window id from child window is timed out.'
      );
    }, INITIALIZATION_TIMEOUT);

    return iwpcChildWindow;
  }

  public close() {
    this._iwpcTopic?.close();
    this._childWindowIdMap = undefined;
    this._childWindowResolveMap = undefined;
    this._childWindowRejectMap = undefined;
    this._iwpcRegisteredProcessMap = undefined;
  }

  private async _initialize() {
    if (this._parentWindow === null) {
      console.warn(
        'Initialization as a ItpcWindow was skipped since there is no parent window for this window.'
      );
    }

    // Add EventListener
    this.window.addEventListener(
      'message',
      this._notifyWindowIdMessageHandler.bind(this)
    );
    this.window.addEventListener(
      'message',
      this._receivedWindowIdMessageHandler.bind(this)
    );

    setTimeout(() => {
      this._rejectReady?.();
    }, INITIALIZATION_TIMEOUT);

    const notifyIdMessage: NotifyWindowId = {
      type: 'NOTIFIY_WINDOW_ID',
      myWindowId: this._windowId
    };
    this._parentWindow?.postMessage(notifyIdMessage, '*');
  }

  private _createChildWindowFeatures(options?: ChildWindowOption) {
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

  private _notifyWindowIdMessageHandler(message: MessageEvent<NotifyWindowId>) {
    if (message.data.type === 'NOTIFIY_WINDOW_ID') {
      if (!message.source || !messageEventSourceIsWindow(message.source)) {
        return;
      }
      if (message.source === this.window) {
        return;
      }
      const childWindowId = message.data.myWindowId;
      const childWindow = message.source;
      this._childWindowIdMap?.set(childWindowId, childWindow);

      const receivedIdMessage: RecievedWindowId = {
        type: 'RECEIVED_WINDOW_ID',
        yourWindowId: childWindowId,
        myWindowId: this._windowId
      };
      message.source.postMessage(receivedIdMessage, '*');
      const iwpcWindow = new IwpcWindowAgent(
        childWindow,
        childWindowId,
        this._windowId
      );
      this._childWindowResolveMap?.get(childWindow)?.(iwpcWindow);
    }
  }

  private _receivedWindowIdMessageHandler(
    message: MessageEvent<RecievedWindowId>
  ) {
    if (message.data.type === 'RECEIVED_WINDOW_ID') {
      if (!message.source) {
        return;
      }
      if (message.source === this.window) {
        return;
      }
      this._parentWindowId = message.data.myWindowId;
      this._resolveReady?.(true);
    }
  }

  private _iwpcMessageSubscriber(message: IwpcMessage) {
    if (message.targetWindowId !== this._windowId) {
      return;
    }
    if (message.type !== 'INVOKE') {
      return;
    }
    const returnValue = this._iwpcRegisteredProcessMap?.get(
      message.processId
    )?.(message.args);
    const iwpcReturnMessage: IwpcReturnMessage = {
      type: 'RETURN',
      iwpcInternalId: message.iwpcInternalId,
      processId: message.processId,
      targetWindowId: message.senderWindowId,
      senderWindowId: this.windowId,
      returnValue: returnValue
    };
    this._iwpcTopic.publish(iwpcReturnMessage);
  }
}