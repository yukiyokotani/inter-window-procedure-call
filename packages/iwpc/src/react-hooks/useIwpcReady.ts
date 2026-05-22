'use client';
import { useEffect, useState } from 'react';

import { IwpcWindow } from '../iwpc-window/iwpcWindow';

/**
 * Track an {@link IwpcWindow}'s readiness as React state so components can
 * react to the handshake completing.
 *
 * Returns `'pending'` until the underlying `iwpc.ready` promise settles,
 * then `'ready'` on resolve or `'failed'` on reject (typically a handshake
 * timeout or a disposal before the handshake completed).
 *
 * `parentIwpcWindow` is populated synchronously for the postMessage
 * transport (root windows) and asynchronously for the broadcastChannel
 * transport (child windows wait for the parent's ack). React does not
 * observe imperative mutations on the IwpcWindow instance, so derive
 * UI from this hook instead of reading `iwpc.parentIwpcWindow` directly.
 */
export const useIwpcReady = (
  iwpc: IwpcWindow | undefined
): 'pending' | 'ready' | 'failed' => {
  const [status, setStatus] = useState<'pending' | 'ready' | 'failed'>(
    'pending'
  );

  useEffect(() => {
    if (!iwpc) {
      setStatus('pending');
      return;
    }
    let cancelled = false;
    setStatus('pending');
    iwpc.ready.then(
      () => {
        if (!cancelled) setStatus('ready');
      },
      () => {
        if (!cancelled) setStatus('failed');
      }
    );
    return () => {
      cancelled = true;
    };
  }, [iwpc]);

  return status;
};
