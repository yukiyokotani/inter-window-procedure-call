'use client';
import { useIwpcWindow } from '@silurus/iwpc/index';
import { useCallback, useEffect, useState } from 'react';

const INCREMENT_COUNTER = 'INCREMENT_COUNTER';

export default function Page(): JSX.Element {
  const iwpcWindow = useIwpcWindow({ debug: true });
  const [count, setCount] = useState(0);

  const incrementCounter = useCallback(() => {
    setCount((count) => ++count);
  }, []);

  useEffect(() => {
    iwpcWindow?.register(INCREMENT_COUNTER, incrementCounter);
    return () => {
      iwpcWindow?.unregister(INCREMENT_COUNTER);
    };
  }, [iwpcWindow, incrementCounter]);

  return (
    <div>
      <h1 className='text-xl'>Child 1</h1>
      <div>Count {count}</div>
      <div>
        <button
          type='button'
          onClick={() => {
            // console.log(iwpcWindow, iwpcWindow?.parentIwpcWindow);
            iwpcWindow?.parentIwpcWindow?.invoke(
              'INCREMENT_COUNTER',
              undefined
            );
          }}
        >
          invoke parent 1 counter increment
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
