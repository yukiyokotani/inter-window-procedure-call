'use client';
import { IwpcWindowAgent, useIwpcWindow } from '@silurus/iwpc/index';
import { useCallback, useEffect, useRef, useState } from 'react';

const INCREMENT_COUNTER = 'INCREMENT_COUNTER';

export default function Page(): JSX.Element {
  const iwpcWindow = useIwpcWindow({ debug: true });
  const [count, setCount] = useState(0);

  const iwpcChildWindowRef = useRef<IwpcWindowAgent>();

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
      <h1 className='text-xl'>Parent 1</h1>
      <div>Count {count}</div>
      <div>
        <button
          type='button'
          onClick={async () => {
            iwpcChildWindowRef.current = await iwpcWindow?.open('./child1', {
              width: 600,
              height: 200,
              top: 0,
              left: 800
            });
          }}
        >
          open child 1
        </button>
        <button
          type='button'
          onClick={() => {
            iwpcChildWindowRef.current?.invoke('INCREMENT_COUNTER', undefined);
          }}
        >
          invoke child 1 counter increment
        </button>
      </div>
    </div>
  );
}
