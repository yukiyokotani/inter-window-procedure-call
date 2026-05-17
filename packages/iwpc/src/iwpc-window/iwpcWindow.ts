import { nanoid } from 'nanoid';

import { Subscription } from '../topic/subscription';
import { Topic } from '../topic/topic';

import {
  INITIALIZATION_TIMEOUT,
  IWPC_PARENT_ID_QUERY_PARAM,
  IWPC_WINDOW_ID_QUERY_PARAM
} from './constants';
import {
  IwpcDisposedError,
  IwpcHandshakeError,
  IwpcProcedureNotFoundError
} from './errors';
import { IwpcWindowAgent } from './iwpcWindowAgent';
import { Logger } from './logger';
import {
  IwpcMessage,
  IwpcReadyMessage,
  IwpcReturnMessage,
  NotifyWindowIdMessage,
  ReceivedWindowIdMessage
} from './message';
import { messageEventSourceIsWindow } from './utils';

export type IwpcTransport = 'postMessage' | 'broadcastChannel';

export type IwpcOptions = {
  debug?: boolean;
  /**
   * Transport used to bootstrap the window-id handshake.
   * - `postMessage` (default): requires `window.opener`; original behavior.
   * - `broadcastChannel`: the parent injects ids into the child URL via query
   *   parameters, so no opener/referrer is needed and the windows run on
   *   independent event loops.
   *
   * Procedure invocation itself always uses BroadcastChannel.
   */
  transport?: IwpcTransport;
};

type ChildWindowOptions = {
  target?: string | undefined;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  /**
   * Detach the child from `window.opener` (broadcastChannel transport only).
   * Defaults to true since the BroadcastChannel transport does not need the
   * opener reference.
   */
  noopener?: boolean;
};

type ChildPending = {
  resolve: (value: IwpcWindowAgent) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class IwpcWindow extends Logger {
  private _options?: IwpcOptions;
  private _transport: IwpcTransport;

  // window
  private _window: Window;
  private _windowId: string;
  private _parentWindow: Window | null;
  private _parentWindowId: string | undefined;
  private _parentIwpcWindow: IwpcWindowAgent | undefined;

  // postMessage transport bookkeeping
  private _childWindowResolveMap: WeakMap<
    Window,
    (value: IwpcWindowAgent) => void
  >;
  private _childWindowRejectMap: WeakMap<Window, (reason: unknown) => void>;

  // broadcastChannel transport bookkeeping
  private _pendingChildren: Map<string, ChildPending>;

  // Subscription
  private _iwpcTopic: Topic<'IWPC', IwpcMessage>;
  private _invokeSubscription: Subscription | undefined;
  private _readySubscription: Subscription | undefined;

  // Iwpc
  private _iwpcRegisteredProcessMap: Map<string, (args: unknown) => unknown>;

  // Bound event handlers (so removeEventListener works)
  private _boundNotifyHandler: (event: MessageEvent) => void;
  private _boundReceivedHandler: (event: MessageEvent) => void;

  // status
  private _ready: Promise<boolean>;
  private _resolveReady: (value: boolean | PromiseLike<boolean>) => void;
  private _rejectReady: (reason?: unknown) => void;
  private _readyTimer: ReturnType<typeof setTimeout> | undefined;
  private _initialized: boolean;
  private _disposed: boolean;
  private _expectedOrigin: string;

  constructor(window: Window, options?: IwpcOptions) {
    super(options?.debug === true);
    this._options = options;
    this._transport = options?.transport ?? 'postMessage';
    this._window = window;
    this._parentWindow = window.opener;
    this._childWindowResolveMap = new WeakMap();
    this._childWindowRejectMap = new WeakMap();
    this._pendingChildren = new Map();
    this._iwpcRegisteredProcessMap = new Map();
    this._initialized = false;
    this._disposed = false;
    this._expectedOrigin = window.location.origin;

    let resolveReady!: (value: boolean | PromiseLike<boolean>) => void;
    let rejectReady!: (reason?: unknown) => void;
    this._ready = new Promise<boolean>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    this._resolveReady = resolveReady;
    this._rejectReady = rejectReady;
    this._ready.catch(() => {
      /* prevent unhandled rejection if no one awaits ready */
    });

    this._iwpcTopic = new Topic<'IWPC', IwpcMessage>('IWPC');

    if (this._transport === 'broadcastChannel') {
      const queryIds = this._readQueryParamIds();
      this._windowId = queryIds.ownId ?? nanoid();
      if (queryIds.parentId) {
        this._parentWindowId = queryIds.parentId;
      }
    } else {
      this._windowId = nanoid();
    }

    this._boundNotifyHandler = this._notifyWindowIdMessageHandler.bind(this);
    this._boundReceivedHandler = this._receivedWindowIdMessageHandler.bind(this);

    this._log(
      '⚙️ Constructor executed,',
      `transport: ${this._transport},`,
      `windowId: ${this._windowId}`
    );
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

  get transport() {
    return this._transport;
  }

  get ready() {
    return this._ready;
  }

  public initialize() {
    if (this._initialized || this._disposed) return;
    this._initialized = true;

    this._invokeSubscription = this._iwpcTopic.subscribe(
      this._invokeMessageSubscriber.bind(this)
    );
    this._readySubscription = this._iwpcTopic.subscribe(
      this._readyMessageSubscriber.bind(this)
    );

    if (this._transport === 'postMessage') {
      this._initializePostMessage();
    } else {
      this._initializeBroadcastChannel();
    }
  }

  /**
   * Register a procedure callable from other windows.
   *
   * The type parameters constrain how the caller of this method sees the
   * handler signature; they have no runtime effect. Pair them with matching
   * type arguments on the remote `invoke<Args, Return>(...)` to keep both
   * sides in sync — typically by importing the same procedure-table types in
   * both windows.
   */
  public register<Args = unknown, Return = unknown>(
    processId: string,
    callback: (args: Args) => Return | Promise<Return>
  ) {
    this._iwpcRegisteredProcessMap.set(
      processId,
      callback as (args: unknown) => unknown
    );
  }

  public unregister(processId: string) {
    this._iwpcRegisteredProcessMap.delete(processId);
  }

  public async open(
    path: string,
    options?: ChildWindowOptions
  ): Promise<IwpcWindowAgent> {
    await this._ready;
    if (this._disposed) {
      throw new IwpcDisposedError('IwpcWindow has been disposed.');
    }

    if (this._transport === 'broadcastChannel') {
      return this._openBroadcastChannel(path, options);
    }
    return this._openPostMessage(path, options);
  }

  public dispose() {
    if (this._disposed) return;
    this._disposed = true;

    if (this._readyTimer !== undefined) {
      clearTimeout(this._readyTimer);
      this._readyTimer = undefined;
    }
    // Reject ready if still pending; the catch attached in the constructor
    // swallows the rejection so callers that never awaited it stay safe.
    this._rejectReady(new IwpcDisposedError('IwpcWindow disposed.'));

    this._invokeSubscription?.unsubscribe();
    this._readySubscription?.unsubscribe();
    this._parentIwpcWindow?.dispose();

    for (const [, entry] of this._pendingChildren) {
      clearTimeout(entry.timer);
      entry.reject(new IwpcDisposedError('IwpcWindow disposed.'));
    }
    this._pendingChildren.clear();

    this._iwpcTopic.close();
    this._iwpcRegisteredProcessMap.clear();

    this._window.removeEventListener('message', this._boundNotifyHandler);
    this._window.removeEventListener('message', this._boundReceivedHandler);
    this._log(`🗑 Disposed iwpcWindow: ${this._windowId}`);
  }

  public close() {
    this.dispose();
    this._window.close();
  }

  // ---------- postMessage transport ----------

  private _initializePostMessage() {
    this._window.addEventListener('message', this._boundNotifyHandler);
    this._window.addEventListener('message', this._boundReceivedHandler);
    this._debug('⚙️ EventListeners have been registered.');

    if (this._parentWindow === null || this._parentWindow === this._window) {
      this._warn(
        '⚙️ Initialization as an IwpcWindow was skipped because the parent window does not exist.'
      );
      this._resolveReady(true);
      return;
    }

    this._readyTimer = setTimeout(() => {
      this._readyTimer = undefined;
      this._error(
        '🆔⏱ The process timed out without receiving a message of ID receipt from the parent window.'
      );
      this._rejectReady(
        new IwpcHandshakeError(
          'IwpcWindow handshake with parent timed out.'
        )
      );
    }, INITIALIZATION_TIMEOUT);

    const notifyIdMessage: NotifyWindowIdMessage = {
      type: 'NOTIFY_WINDOW_ID',
      myWindowId: this._windowId
    };
    try {
      this._parentWindow.postMessage(notifyIdMessage, this._expectedOrigin);
      this._log('🆔📮 ID notification message sent to parentwindow.');
    } catch (e) {
      this._error('🆔❌ Failed to send ID notification.', e);
      this._rejectReady(e);
    }
  }

  private _openPostMessage(
    path: string,
    options?: ChildWindowOptions
  ): Promise<IwpcWindowAgent> {
    const target = options?.target ?? '_blank';
    const features = this._createChildWindowFeatures(options);

    return new Promise<IwpcWindowAgent>((resolve, reject) => {
      const childWindow = this._window.open(path, target, features);
      if (!childWindow) {
        reject(
          new IwpcHandshakeError(
            'Could not obtain a reference to the child window.'
          )
        );
        return;
      }
      this._childWindowResolveMap.set(childWindow, resolve);
      this._childWindowRejectMap.set(childWindow, reject);
      setTimeout(() => {
        if (this._childWindowResolveMap.has(childWindow)) {
          this._childWindowResolveMap.delete(childWindow);
          this._childWindowRejectMap.delete(childWindow);
          reject(
            new IwpcHandshakeError(
              'Notification of id from child window timed out. The child window is closed because communication is not available.'
            )
          );
        }
      }, INITIALIZATION_TIMEOUT);
    });
  }

  private _notifyWindowIdMessageHandler(event: MessageEvent) {
    const data = event.data as Partial<NotifyWindowIdMessage> | null;
    if (!data || data.type !== 'NOTIFY_WINDOW_ID') return;
    if (event.origin !== this._expectedOrigin) {
      this._debug(
        '🆔📬 Ignored ID notification from disallowed origin:',
        event.origin
      );
      return;
    }
    if (!event.source || !messageEventSourceIsWindow(event.source)) {
      this._debug(
        '🆔📬 Ignored ID notification: source is not a window.'
      );
      return;
    }
    if (event.source === this._window) return;
    if (typeof data.myWindowId !== 'string') return;

    this._log('🆔📬 ID notification received from child window.');
    const childWindowId = data.myWindowId;
    const childWindow = event.source;

    const receivedIdMessage: ReceivedWindowIdMessage = {
      type: 'RECEIVED_WINDOW_ID',
      yourWindowId: childWindowId,
      myWindowId: this._windowId
    };
    try {
      childWindow.postMessage(receivedIdMessage, this._expectedOrigin);
    } catch (e) {
      this._error('🆔❌ Failed to acknowledge child window id.', e);
      return;
    }
    const iwpcAgent = new IwpcWindowAgent(
      childWindow,
      childWindowId,
      this._windowId,
      this._iwpcTopic,
      { debug: this._options?.debug }
    );
    this._childWindowResolveMap.get(childWindow)?.(iwpcAgent);
    this._childWindowResolveMap.delete(childWindow);
    this._childWindowRejectMap.delete(childWindow);
    this._log('🆔📮 Message of ID receipt sent to child window.');
  }

  private _receivedWindowIdMessageHandler(event: MessageEvent) {
    const data = event.data as Partial<ReceivedWindowIdMessage> | null;
    if (!data || data.type !== 'RECEIVED_WINDOW_ID') return;
    if (event.origin !== this._expectedOrigin) {
      this._debug(
        '🆔📬 Ignored ID receipt from disallowed origin:',
        event.origin
      );
      return;
    }
    if (!event.source || !messageEventSourceIsWindow(event.source)) {
      this._debug('🆔📬 Ignored ID receipt: source is not a window.');
      return;
    }
    if (event.source === this._window) return;
    if (data.yourWindowId !== this._windowId) return;
    if (typeof data.myWindowId !== 'string') return;

    this._log(
      '🆔📬 Confirmed that the parent window has successfully received the ID of this window.'
    );
    this._parentWindowId = data.myWindowId;
    this._parentIwpcWindow = new IwpcWindowAgent(
      event.source,
      this._parentWindowId,
      this._windowId,
      this._iwpcTopic,
      { debug: this._options?.debug }
    );
    if (this._readyTimer !== undefined) {
      clearTimeout(this._readyTimer);
      this._readyTimer = undefined;
    }
    this._resolveReady(true);
    this._log("👾 The parent window's agent is now ready.");
  }

  // ---------- broadcastChannel transport ----------

  private _initializeBroadcastChannel() {
    if (this._parentWindowId !== undefined) {
      // Parent id was passed via query parameter; build the agent immediately
      // and broadcast a READY message so the parent can resolve its open()
      // promise.
      this._parentIwpcWindow = new IwpcWindowAgent(
        null,
        this._parentWindowId,
        this._windowId,
        this._iwpcTopic,
        { debug: this._options?.debug }
      );
      const ready: IwpcReadyMessage = {
        type: 'READY',
        senderWindowId: this._windowId
      };
      this._iwpcTopic.publish(ready);
      this._log('📣 Broadcasted READY message.');
    } else {
      this._debug('⚙️ No parent id in query params; running as root window.');
    }
    this._resolveReady(true);
  }

  private _openBroadcastChannel(
    path: string,
    options?: ChildWindowOptions
  ): Promise<IwpcWindowAgent> {
    const childWindowId = nanoid();
    const url = this._appendIwpcQueryParams(path, childWindowId);
    const target = options?.target ?? '_blank';
    const noopener = options?.noopener ?? true;
    const features = [
      this._createChildWindowFeatures(options),
      noopener ? 'noopener' : ''
    ]
      .filter(Boolean)
      .join(',');

    return new Promise<IwpcWindowAgent>((resolve, reject) => {
      const opened = this._window.open(url, target, features);
      if (!noopener && !opened) {
        reject(new IwpcHandshakeError('Could not open the child window.'));
        return;
      }

      const timer = setTimeout(() => {
        if (this._pendingChildren.has(childWindowId)) {
          this._pendingChildren.delete(childWindowId);
          reject(
            new IwpcHandshakeError(
              `Timed out waiting for child window ${childWindowId} to broadcast READY.`
            )
          );
        }
      }, INITIALIZATION_TIMEOUT);

      this._pendingChildren.set(childWindowId, { resolve, reject, timer });
    });
  }

  private _readyMessageSubscriber(message: IwpcMessage) {
    if (message.type !== 'READY') return;
    const childWindowId = message.senderWindowId;
    const pending = this._pendingChildren.get(childWindowId);
    if (!pending) return;
    this._pendingChildren.delete(childWindowId);
    clearTimeout(pending.timer);
    const agent = new IwpcWindowAgent(
      null,
      childWindowId,
      this._windowId,
      this._iwpcTopic,
      { debug: this._options?.debug }
    );
    pending.resolve(agent);
    this._log('🆔📬 Child window READY received.', childWindowId);
  }

  // ---------- shared helpers ----------

  private _appendIwpcQueryParams(path: string, childWindowId: string): string {
    const baseUrl = new URL(path, this._window.location.href);
    baseUrl.searchParams.set(IWPC_WINDOW_ID_QUERY_PARAM, childWindowId);
    baseUrl.searchParams.set(IWPC_PARENT_ID_QUERY_PARAM, this._windowId);
    if (baseUrl.origin === this._expectedOrigin) {
      return `${baseUrl.pathname}${baseUrl.search}${baseUrl.hash}`;
    }
    return baseUrl.toString();
  }

  private _readQueryParamIds(): {
    ownId: string | undefined;
    parentId: string | undefined;
  } {
    try {
      const params = new URLSearchParams(this._window.location.search);
      return {
        ownId: params.get(IWPC_WINDOW_ID_QUERY_PARAM) ?? undefined,
        parentId: params.get(IWPC_PARENT_ID_QUERY_PARAM) ?? undefined
      };
    } catch {
      return { ownId: undefined, parentId: undefined };
    }
  }

  private _createChildWindowFeatures(options?: ChildWindowOptions) {
    const featureLeft = `left=${options?.left ?? 0}`;
    const featureTop = `top=${options?.top ?? 0}`;
    const featureWidth = `width=${options?.width ?? 800}`;
    const featureHeight = `height=${options?.height ?? 600}`;
    return [featureLeft, featureTop, featureWidth, featureHeight, 'popup'].join(
      ','
    );
  }

  private _invokeMessageSubscriber(message: IwpcMessage) {
    if (message.type !== 'INVOKE') return;
    if (message.targetWindowId !== this._windowId) return;

    this._log('↪ Received a message of procedural call request.', message);
    const procedure = this._iwpcRegisteredProcessMap.get(message.processId);
    if (procedure === undefined) {
      this._warn(
        'The requested procedure call is not registered.',
        `processId: ${message.processId}`,
        `taskId: ${message.iwpcTaskId}`,
        `requester: ${message.senderWindowId}`
      );
      const notFound = new IwpcProcedureNotFoundError(message.processId);
      const errorReturn: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: message.iwpcTaskId,
        processId: message.processId,
        targetWindowId: message.senderWindowId,
        senderWindowId: this._windowId,
        returnValue: undefined,
        error: {
          name: notFound.name,
          message: notFound.message
        }
      };
      this._iwpcTopic.publish(errorReturn);
      return;
    }

    void (async () => {
      let returnValue: unknown;
      let error: IwpcReturnMessage['error'];
      try {
        returnValue = await procedure(message.args);
      } catch (e) {
        const err =
          e instanceof Error
            ? e
            : new Error(typeof e === 'string' ? e : 'Unknown error');
        error = { name: err.name, message: err.message };
      }
      const iwpcReturnMessage: IwpcReturnMessage = {
        type: 'RETURN',
        iwpcTaskId: message.iwpcTaskId,
        processId: message.processId,
        targetWindowId: message.senderWindowId,
        senderWindowId: this._windowId,
        returnValue: returnValue,
        ...(error ? { error } : {})
      };
      this._iwpcTopic.publish(iwpcReturnMessage);
      this._log(
        '↩ Sent a message of the result of the procedure call.',
        iwpcReturnMessage
      );
    })();
  }
}

