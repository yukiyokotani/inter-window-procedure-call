'use client';

import { CounterParentBody } from '@/components/counter-parent';

const SNIPPET = `import { useIwpcWindow } from '@silurus/iwpc';

const iwpc = useIwpcWindow();

// Register a procedure callers can invoke on this window.
useEffect(() => {
  iwpc?.register('INCREMENT_COUNTER', () => setCount((c) => c + 1));
  return () => iwpc?.unregister('INCREMENT_COUNTER');
}, [iwpc]);

// Open a child window and invoke its procedure remotely.
const child = await iwpc?.open('./child', { width: 520, height: 540 });
child?.invoke('INCREMENT_COUNTER');`;

export default function Page() {
  return (
    <CounterParentBody
      transport='postMessage'
      transportLabel='postMessage'
      snippet={SNIPPET}
      intro={
        <>
          Either side calls{' '}
          <code className='font-mono'>INCREMENT_COUNTER</code> on the other.
          Fire-and-forget — no return value. The legacy{' '}
          <code className='font-mono'>postMessage</code> transport keeps
          <code className='font-mono'> window.opener</code> wired up, so the
          parent and child share an event loop.
        </>
      }
    />
  );
}
