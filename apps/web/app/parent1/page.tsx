'use client';

import { IwpcWindowAgent, useIwpcWindow } from '@silurus/iwpc/index';
import { ExternalLink, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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

export default function Page() {
  const iwpcWindow = useIwpcWindow({ debug: true });
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
    const agent = await iwpcWindow?.open('./child1', {
      width: 520,
      height: 540,
      top: 80,
      left: 720
    });
    if (agent) {
      childRef.current = agent;
      setChild(agent);
    }
  }, [iwpcWindow]);

  const invokeChild = useCallback(() => {
    childRef.current?.invoke(PROCEDURES.INCREMENT_COUNTER, undefined);
  }, []);

  return (
    <WindowFrame
      title='Counter — Parent'
      role='Parent'
      transport='postMessage'
      windowId={iwpcWindow?.windowId}
      status={iwpcWindow ? 'connected' : 'connecting'}
    >
      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Shared counter</CardTitle>
          <CardDescription>
            Either side calls <code className='font-mono'>INCREMENT_COUNTER</code> on
            the other. Fire-and-forget — no return value.
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
            Open a paired popup. Click the second button to increment the
            child&apos;s counter remotely.
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
    </WindowFrame>
  );
}
