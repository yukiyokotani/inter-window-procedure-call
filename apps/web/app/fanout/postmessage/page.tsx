'use client';

import { FanoutParentBody } from '@/components/fanout-parent';

const SNIPPET = `// Parent
const iwpc = useIwpcWindow();

// Open several children — each registers the same handler.
for (let i = 0; i < 3; i++) {
  await iwpc?.open('./child', { width: 480, height: 460 });
}

// One call fires INCREMENT_COUNTER on every other window
// on the same channelName + origin. Fire-and-forget — no return.
iwpc?.broadcast('INCREMENT_COUNTER');

// Child
useEffect(() => {
  iwpc?.register('INCREMENT_COUNTER', () => setCount((c) => c + 1));
  return () => iwpc?.unregister('INCREMENT_COUNTER');
}, [iwpc]);`;

export default function Page() {
  return (
    <FanoutParentBody
      transport='postMessage'
      transportLabel='postMessage'
      snippet={SNIPPET}
      intro={
        <>
          The parent opens several popups and fires{' '}
          <code className='font-mono'>broadcast(&apos;INCREMENT_COUNTER&apos;)</code>
          {' '}once. Every child that registered the procedure runs its
          handler. The sender does <em>not</em> receive its own broadcast.
        </>
      }
    />
  );
}
