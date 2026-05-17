import { describe, expect, it } from 'vitest';

import {
  IwpcAbortError,
  IwpcDisposedError,
  IwpcError,
  IwpcHandshakeError,
  IwpcProcedureNotFoundError,
  IwpcRemoteError,
  IwpcTimeoutError
} from './errors';

describe('IwpcError hierarchy', () => {
  it('every concrete error extends IwpcError', () => {
    expect(new IwpcTimeoutError('p', 1)).toBeInstanceOf(IwpcError);
    expect(new IwpcProcedureNotFoundError('p')).toBeInstanceOf(IwpcError);
    expect(new IwpcDisposedError()).toBeInstanceOf(IwpcError);
    expect(new IwpcAbortError()).toBeInstanceOf(IwpcError);
    expect(new IwpcRemoteError('A', 'b')).toBeInstanceOf(IwpcError);
    expect(new IwpcHandshakeError('x')).toBeInstanceOf(IwpcError);
  });

  it('every concrete error extends the global Error class', () => {
    expect(new IwpcTimeoutError('p', 1)).toBeInstanceOf(Error);
  });

  it('sets a stable, distinguishable `name`', () => {
    expect(new IwpcTimeoutError('p', 1).name).toBe('IwpcTimeoutError');
    expect(new IwpcProcedureNotFoundError('p').name).toBe(
      'IwpcProcedureNotFoundError'
    );
    expect(new IwpcDisposedError().name).toBe('IwpcDisposedError');
    expect(new IwpcAbortError().name).toBe('IwpcAbortError');
    expect(new IwpcRemoteError('A', 'b').name).toBe('IwpcRemoteError');
    expect(new IwpcHandshakeError('x').name).toBe('IwpcHandshakeError');
  });

  it('IwpcTimeoutError carries processId and timeoutMs', () => {
    const e = new IwpcTimeoutError('GREET', 250);
    expect(e.processId).toBe('GREET');
    expect(e.timeoutMs).toBe(250);
    expect(e.message).toContain('GREET');
    expect(e.message).toContain('250');
  });

  it('IwpcProcedureNotFoundError carries processId', () => {
    const e = new IwpcProcedureNotFoundError('UNREG');
    expect(e.processId).toBe('UNREG');
    expect(e.message).toContain('UNREG');
  });

  it('IwpcRemoteError preserves the remote name as a field, not as .name', () => {
    const e = new IwpcRemoteError('CustomFailure', 'kaboom');
    expect(e.remoteName).toBe('CustomFailure');
    expect(e.name).toBe('IwpcRemoteError');
    expect(e.message).toBe('kaboom');
  });
});
