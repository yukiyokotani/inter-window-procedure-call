/**
 * Error classes thrown / rejected by the IWPC library.
 *
 * All concrete IWPC errors extend {@link IwpcError}, so a single
 * `err instanceof IwpcError` check distinguishes IWPC-level failures from
 * unrelated thrown values. Use the leaf classes to discriminate further.
 */

export class IwpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IwpcError';
  }
}

/**
 * The remote procedure exceeded the configured per-call timeout.
 */
export class IwpcTimeoutError extends IwpcError {
  readonly processId: string;
  readonly timeoutMs: number;
  constructor(processId: string, timeoutMs: number) {
    super(`IWPC procedure call timed out: ${processId} (after ${timeoutMs}ms)`);
    this.name = 'IwpcTimeoutError';
    this.processId = processId;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * The remote window has no procedure registered under the requested
 * `processId`.
 */
export class IwpcProcedureNotFoundError extends IwpcError {
  readonly processId: string;
  constructor(processId: string) {
    super(`Procedure not registered: ${processId}`);
    this.name = 'IwpcProcedureNotFoundError';
    this.processId = processId;
  }
}

/**
 * The IwpcWindow / IwpcWindowAgent the call was issued against has been
 * disposed (or was disposed while the call was in flight).
 */
export class IwpcDisposedError extends IwpcError {
  constructor(message = 'IWPC endpoint has been disposed.') {
    super(message);
    this.name = 'IwpcDisposedError';
  }
}

/**
 * The caller-supplied `AbortSignal` was aborted before the procedure
 * returned. Note that the remote procedure is not actually cancelled — once
 * sent, the request runs to completion on the remote side; only the local
 * waiting promise is abandoned.
 */
export class IwpcAbortError extends IwpcError {
  constructor(message = 'IWPC invocation aborted.') {
    super(message);
    this.name = 'IwpcAbortError';
  }
}

/**
 * The remote procedure threw an error. The original `name` and `message`
 * are preserved on {@link remoteName} / `message`; the prototype chain of
 * the remote error is not (it cannot survive structured cloning).
 */
export class IwpcRemoteError extends IwpcError {
  readonly remoteName: string;
  constructor(remoteName: string, message: string) {
    super(message);
    this.name = 'IwpcRemoteError';
    this.remoteName = remoteName;
  }
}

/**
 * The handshake between parent and child window failed (timeout, popup
 * blocked, etc).
 */
export class IwpcHandshakeError extends IwpcError {
  constructor(message: string) {
    super(message);
    this.name = 'IwpcHandshakeError';
  }
}

/**
 * Union of every error class IWPC rejects/throws. Useful for exhaustive
 * `switch` statements.
 */
export type IwpcAnyError =
  | IwpcTimeoutError
  | IwpcProcedureNotFoundError
  | IwpcDisposedError
  | IwpcAbortError
  | IwpcRemoteError
  | IwpcHandshakeError;
