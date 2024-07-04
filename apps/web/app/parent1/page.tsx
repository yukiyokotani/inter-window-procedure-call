'use client';
import { IwpcWindow, IwpcWindowAgent } from '@repo/iwpc/index';
import { useRef } from 'react';

const iwpcWindow = new IwpcWindow(window);

export default function Page(): JSX.Element {
  const iwpcChildWindowRef = useRef<IwpcWindowAgent>();

  return (
    <div>
      <h1 className='text-xl'>Parent 1</h1>
      <button
        type='button'
        onClick={async () => {
          iwpcChildWindowRef.current = await iwpcWindow.open('./child1');
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
  );
}
