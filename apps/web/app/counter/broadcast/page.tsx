'use client';

import { CounterParentBody } from '@/components/counter-parent';

const SNIPPET = `import { useIwpcWindow } from '@silurus/iwpc';

const iwpc = useIwpcWindow({
  transport: 'broadcastChannel',
  // channelName: 'myapp:iwpc', // pin per app to avoid origin-wide collisions
});

useEffect(() => {
  iwpc?.register('INCREMENT_COUNTER', () => setCount((c) => c + 1));
  return () => iwpc?.unregister('INCREMENT_COUNTER');
}, [iwpc]);

// noopener by default — no Window reference between the two sides.
const child = await iwpc?.open('./child', { width: 520, height: 540 });
child?.invoke('INCREMENT_COUNTER');`;

export default function Page() {
  return (
    <CounterParentBody
      transport='broadcastChannel'
      transportLabel='BroadcastChannel'
      snippet={SNIPPET}
      intro={
        <>
          Same counter demo. The child opens with{' '}
          <code className='font-mono'>noopener</code> and runs on its{' '}
          <strong className='font-semibold text-foreground'>own event loop</strong>
          {' '}— a busy parent never freezes the child, and vice versa.
        </>
      }
    />
  );
}
