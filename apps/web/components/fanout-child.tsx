'use client';

import {
  type IwpcOptions,
  useIwpcReady,
  useIwpcWindow
} from '@silurus/iwpc';
import { useCallback, useEffect, useState } from 'react';

import { CodeBlock } from '@/components/code-block';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { WindowFrame } from '@/components/window-frame';
import { PROCEDURES } from '@/lib/procedures';
import { readinessToStatus } from '@/lib/readiness';

type Transport = NonNullable<IwpcOptions['transport']>;

type Props = {
  transport: Transport;
  transportLabel: 'postMessage' | 'BroadcastChannel';
  snippet: string;
};

export function FanoutChildBody({
  transport,
  transportLabel,
  snippet
}: Props) {
  const iwpcWindow = useIwpcWindow({ debug: true, transport });
  const readiness = useIwpcReady(iwpcWindow);
  const [count, setCount] = useState(0);

  const increment = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  useEffect(() => {
    iwpcWindow?.register(PROCEDURES.INCREMENT_COUNTER, increment);
    return () => iwpcWindow?.unregister(PROCEDURES.INCREMENT_COUNTER);
  }, [iwpcWindow, increment]);

  return (
    <WindowFrame
      title='Broadcast listener'
      role='Child'
      transport={transportLabel}
      windowId={iwpcWindow?.windowId}
      parentId={iwpcWindow?.parentWindowId}
      status={readinessToStatus(readiness)}
    >
      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Local counter</CardTitle>
          <CardDescription>
            This counter ticks up every time the parent fires
            <code className='font-mono'> broadcast(&apos;INCREMENT_COUNTER&apos;)</code>.
            No direct invoke, no return value — just a fan-out call.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between rounded-lg border border-border bg-background/50 p-6'>
            <span className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
              Count
            </span>
            <span className='font-mono text-5xl font-semibold tabular-nums'>
              {count}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Code</CardTitle>
          <CardDescription>The child side.</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={snippet} filename='child.tsx' />
        </CardContent>
      </Card>
    </WindowFrame>
  );
}
