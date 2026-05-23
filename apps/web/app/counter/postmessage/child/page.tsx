'use client';

import { CounterChildBody } from '@/components/counter-child';

const SNIPPET = `import { useIwpcWindow } from '@silurus/iwpc';

const iwpc = useIwpcWindow();

useEffect(() => {
  iwpc?.register('INCREMENT_COUNTER', () => setCount((c) => c + 1));
  return () => iwpc?.unregister('INCREMENT_COUNTER');
}, [iwpc]);

// Invoke a procedure on the parent.
iwpc?.parentIwpcWindow?.invoke('INCREMENT_COUNTER');`;

export default function Page() {
  return (
    <CounterChildBody
      transport='postMessage'
      transportLabel='postMessage'
      snippet={SNIPPET}
    />
  );
}
