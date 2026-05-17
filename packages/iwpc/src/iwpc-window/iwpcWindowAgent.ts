import { nanoid } from 'nanoid';

import { Subscription } from '../topic/subscription';
import { Topic } from '../topic/topic';

import { IWPC_PROCESS_TIMEOUT } from './constants';
import {
  IwpcAbortError,
  IwpcDisposedError,
  IwpcProcedureNotFoundError,
  IwpcRemoteError,
  IwpcTimeoutError
} from './errors';
import { Logger } from './logger';
import { IwpcInvokeMessage, IwpcMessage } from './message';

export type IwpcAgentOptions = {
  debug?: boolean;
};

export type InvokeOptions = {
  /**
   * Maximum time, in ms, to wait for a RETURN message before rejecting with
   * an {@link IwpcTimeoutError}. Defaults to {@link IWPC_PROCESS_TIMEOUT}.
   */
  timeout?: number;
  /**
   * Abort the pending invocation. The promise rejects with an
   * {@link IwpcAbortError}.
   *
   * Important: the remote procedure is NOT cancelled — once the INVOKE
   * message has been published, the remote side runs to completion. Aborting
   * only abandons the local waiting promise so the caller can move on.
   */
  signal?: AbortSignal;
};

type PendingInvocation = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortListener?: () => void;
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

  /**
   * Invoke a procedure registered on the remote window.
   *
   * The two type parameters carry the call's input/output shape; they have
   * no runtime effect. Apply the same types on the remote side's
   * {@link IwpcWindow.register} call (typically by sharing a procedure-table
   * type between the two windows) to keep them in sync.
   *
   * Rejection types:
   * - {@link IwpcDisposedError} — the agent (or its parent window) has been disposed.
   * - {@link IwpcTimeoutError} — no RETURN within `options.timeout` ms.
   * - {@link IwpcAbortError} — `options.signal` was aborted.
   * - {@link IwpcProcedureNotFoundError} — the remote has no procedure with this id.
   * - {@link IwpcRemoteError} — the remote procedure threw.
   */
  public async invoke<Args = void, Return = unknown>(
    processId: string,
    args?: Args,
    options?: InvokeOptions
  ): Promise<Return> {
    if (this._disposed) {
      throw new IwpcDisposedError('IwpcWindowAgent has been disposed.');
    }
    const signal = options?.signal;
    if (signal?.aborted) {
      throw new IwpcAbortError();
    }

    const iwpcTaskId = nanoid();
    const timeoutMs = options?.timeout ?? IWPC_PROCESS_TIMEOUT;

    const returnValue = new Promise<Return>((resolve, reject) => {
      const timer = setTimeout(() => {
        const entry = this._pending.get(iwpcTaskId);
        if (!entry) return;
        this._cleanup(iwpcTaskId);
        this._error(
          '⏱ Procedure call timed out.',
          `processId: ${processId}`,
          `taskId: ${iwpcTaskId}`
        );
        entry.reject(new IwpcTimeoutError(processId, timeoutMs));
      }, timeoutMs);

      const pending: PendingInvocation = {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer
      };

      if (signal) {
        const abortListener = () => {
          const entry = this._pending.get(iwpcTaskId);
          if (!entry) return;
          this._cleanup(iwpcTaskId);
          entry.reject(new IwpcAbortError());
        };
        signal.addEventListener('abort', abortListener, { once: true });
        pending.signal = signal;
        pending.abortListener = abortListener;
      }

      this._pending.set(iwpcTaskId, pending);
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
    for (const [iwpcTaskId, entry] of this._pending) {
      clearTimeout(entry.timer);
      entry.signal?.removeEventListener(
        'abort',
        entry.abortListener as () => void
      );
      entry.reject(new IwpcDisposedError('IwpcWindowAgent disposed.'));
      // Removal happens implicitly via the loop's clear() below; do not
      // mutate _pending mid-iteration via _cleanup.
      void iwpcTaskId;
    }
    this._pending.clear();
  }

  private _cleanup(iwpcTaskId: string) {
    const entry = this._pending.get(iwpcTaskId);
    if (!entry) return;
    clearTimeout(entry.timer);
    if (entry.signal && entry.abortListener) {
      entry.signal.removeEventListener('abort', entry.abortListener);
    }
    this._pending.delete(iwpcTaskId);
  }

  private _returnMessageSubscriber(message: IwpcMessage) {
    if (message.type !== 'RETURN') return;
    if (message.targetWindowId !== this._ownerWindowId) return;
    if (message.senderWindowId !== this._windowId) return;
    const entry = this._pending.get(message.iwpcTaskId);
    if (!entry) return;
    this._cleanup(message.iwpcTaskId);
    if (message.error) {
      entry.reject(
        toRemoteRejection(message.error.name, message.error.message)
      );
      this._log('↩ Procedure call returned an error.', message);
      return;
    }
    entry.resolve(message.returnValue);
    this._log('↩ Returned the results of the procedure call.', message);
  }
}

/**
 * Map an error coming in over the wire back to a typed local rejection.
 * IwpcProcedureNotFoundError is special-cased so call-sites can use
 * `instanceof` to detect "no such procedure" without string matching.
 */
function toRemoteRejection(name: string, message: string): Error {
  if (name === 'IwpcProcedureNotFoundError') {
    return new IwpcProcedureNotFoundError(extractProcessId(message));
  }
  return new IwpcRemoteError(name, message);
}

function extractProcessId(message: string): string {
  const match = /Procedure not registered: (.+)/.exec(message);
  return match?.[1] ?? '';
}
