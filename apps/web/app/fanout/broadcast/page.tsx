'use client';

import { FanoutParentBody } from '@/components/fanout-parent';

const SNIPPET = `// Parent
const iwpc = useIwpcWindow({ transport: 'broadcastChannel' });

for (let i = 0; i < 3; i++) {
  await iwpc?.open('./child', { width: 480, height: 460 });
}

// Same call, regardless of transport. \`broadcast()\` always travels
// over the same BroadcastChannel that powers \`invoke()\`'s routing.
iwpc?.broadcast('INCREMENT_COUNTER');

// Child
const iwpc = useIwpcWindow({ transport: 'broadcastChannel' });

useEffect(() => {
  iwpc?.register('INCREMENT_COUNTER', () => setCount((c) => c + 1));
  return () => iwpc?.unregister('INCREMENT_COUNTER');
}, [iwpc]);`;

export default function Page() {
  return (
    <FanoutParentBody
      transport='broadcastChannel'
      transportLabel='BroadcastChannel'
      snippet={SNIPPET}
      intro={
        <>
          Same fan-out pattern as the postMessage demo. Each child opens
          with <code className='font-mono'>noopener</code> and runs on its
          own event loop, so a stalled child never blocks the parent or
          the other children.
        </>
      }
    />
  );
}
