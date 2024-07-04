'use client';
import { useIwpcWindow } from '@repo/iwpc/index';
import { useCallback, useEffect, useState } from 'react';

export default function Page(): JSX.Element {
  const iwpcWindow = useIwpcWindow();
  const [count, setCount] = useState(0);

  const incrementCounter = useCallback(() => {
    setCount((count) => ++count);
  }, []);

  useEffect(() => {
    iwpcWindow?.register('INCREMENT_COUNTER', incrementCounter);
  }, []);

  return (
    <div>
      <h1 className='text-xl'>Child 1</h1>
      <div>Count {count}</div>
    </div>
  );
}
