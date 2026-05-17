'use client';
import { useIwpcWindow } from '@silurus/iwpc/index';
import { useCallback, useEffect, useState } from 'react';

const INCREMENT_COUNTER = 'INCREMENT_COUNTER';

export default function Page(): JSX.Element {
  const iwpcWindow = useIwpcWindow({
    debug: true,
    transport: 'broadcastChannel'
  });
  const [count, setCount] = useState(0);

  const incrementCounter = useCallback(() => {
    setCount((count) => count + 1);
  }, []);

  useEffect(() => {
    iwpcWindow?.register(INCREMENT_COUNTER, incrementCounter);
    return () => {
      iwpcWindow?.unregister(INCREMENT_COUNTER);
    };
  }, [iwpcWindow, incrementCounter]);

  return (
    <div>
      <h1 className='text-xl'>Child 2 (BroadcastChannel)</h1>
      <p>
        WindowId: <code>{iwpcWindow?.windowId ?? '...'}</code>
        <br />
        ParentId: <code>{iwpcWindow?.parentWindowId ?? '...'}</code>
      </p>
      <div>Count {count}</div>
      <div>
        <button
          type='button'
          onClick={() => {
            iwpcWindow?.parentIwpcWindow?.invoke(INCREMENT_COUNTER, undefined);
          }}
        >
          invoke parent 2 counter increment
        </button>
        <button
          type='button'
          onClick={() => {
            iwpcWindow?.dispose();
          }}
        >
          dispose
        </button>
        <button
          type='button'
          onClick={() => {
            iwpcWindow?.close();
          }}
        >
          close
        </button>
      </div>
    </div>
  );
}
