'use client';

import { FanoutChildBody } from '@/components/fanout-child';

const SNIPPET = `const iwpc = useIwpcWindow();

useEffect(() => {
  iwpc?.register('INCREMENT_COUNTER', () => setCount((c) => c + 1));
  return () => iwpc?.unregister('INCREMENT_COUNTER');
}, [iwpc]);`;

export default function Page() {
  return (
    <FanoutChildBody
      transport='postMessage'
      transportLabel='postMessage'
      snippet={SNIPPET}
    />
  );
}
