'use client';

import { CounterChildBody } from '@/components/counter-child';

const SNIPPET = `import { useIwpcWindow } from '@silurus/iwpc';

const iwpc = useIwpcWindow({ transport: 'broadcastChannel' });

useEffect(() => {
  iwpc?.register('INCREMENT_COUNTER', () => setCount((c) => c + 1));
  return () => iwpc?.unregister('INCREMENT_COUNTER');
}, [iwpc]);

// Child waits for the parent's RECEIVED_WINDOW_ID ack before
// parentIwpcWindow is populated; await iwpc.ready if you need it
// immediately on mount.
iwpc?.parentIwpcWindow?.invoke('INCREMENT_COUNTER');`;

export default function Page() {
  return (
    <CounterChildBody
      transport='broadcastChannel'
      transportLabel='BroadcastChannel'
      snippet={SNIPPET}
    />
  );
}
