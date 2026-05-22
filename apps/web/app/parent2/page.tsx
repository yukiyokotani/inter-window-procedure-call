'use client';

import { IwpcWindowAgent, useIwpcWindow } from '@silurus/iwpc';
import { ExternalLink, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CodeBlock } from '@/components/code-block';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { WindowFrame } from '@/components/window-frame';
import { PROCEDURES } from '@/lib/procedures';

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
const child = await iwpc?.open('./child2', { width: 520, height: 540 });
child?.invoke('INCREMENT_COUNTER');`;

export default function Page() {
  const iwpcWindow = useIwpcWindow({
    debug: true,
    transport: 'broadcastChannel'
  });
  const [count, setCount] = useState(0);
  const [child, setChild] = useState<IwpcWindowAgent | null>(null);
  const childRef = useRef<IwpcWindowAgent | null>(null);

  const incrementCounter = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  useEffect(() => {
    iwpcWindow?.register(PROCEDURES.INCREMENT_COUNTER, incrementCounter);
    return () => {
      iwpcWindow?.unregister(PROCEDURES.INCREMENT_COUNTER);
    };
  }, [iwpcWindow, incrementCounter]);

  const openChild = useCallback(async () => {
    try {
      const agent = await iwpcWindow?.open('./child2', {
        width: 520,
        height: 540,
        top: 80,
        left: 720
      });
      if (agent) {
        childRef.current = agent;
        setChild(agent);
      }
    } catch (e) {
      console.error(e);
    }
  }, [iwpcWindow]);

  const invokeChild = useCallback(() => {
    childRef.current?.invoke(PROCEDURES.INCREMENT_COUNTER, undefined);
  }, []);

  return (
    <WindowFrame
      title='Counter — Parent'
      role='Parent'
      transport='BroadcastChannel'
      windowId={iwpcWindow?.windowId}
      status={iwpcWindow ? 'connected' : 'connecting'}
    >
      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Shared counter</CardTitle>
          <CardDescription>
            Same counter demo as Parent 1, but with the BroadcastChannel
            transport. The child opens with <code className='font-mono'>noopener</code> —
            there is no DOM reference between the two windows.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-6'>
          <div className='flex items-center justify-between rounded-lg border border-border bg-background/50 p-6'>
            <span className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
              Count
            </span>
            <span className='font-mono text-5xl font-semibold tabular-nums'>
              {count}
            </span>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='secondary'
              onClick={() => setCount((c) => Math.max(0, c - 1))}
            >
              <Minus className='size-4' />
              Local −
            </Button>
            <Button onClick={() => setCount((c) => c + 1)}>
              <Plus className='size-4' />
              Local +
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Child window</CardTitle>
          <CardDescription>
            Pairing happens via a query-param handshake — the child
            broadcasts <code className='font-mono'>NOTIFY_WINDOW_ID</code> and the
            parent replies. Reload the child: it re-pairs automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap items-center gap-2'>
          <Button onClick={openChild} disabled={!iwpcWindow}>
            <ExternalLink className='size-4' />
            Open child
          </Button>
          <Button variant='outline' onClick={invokeChild} disabled={!child}>
            <Plus className='size-4' />
            Increment child remotely
          </Button>
        </CardContent>
      </Card>

      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Code</CardTitle>
          <CardDescription>
            Same shape as the postMessage demo — only the transport
            option changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={SNIPPET} filename='parent.tsx' />
        </CardContent>
      </Card>
    </WindowFrame>
  );
}
