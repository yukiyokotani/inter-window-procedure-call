'use client';

import { useIwpcWindow } from '@silurus/iwpc/index';
import { Plus, Power, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
  const iwpcWindow = useIwpcWindow({
    debug: true,
    transport: 'broadcastChannel'
  });
  const [count, setCount] = useState(0);

  const incrementCounter = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  useEffect(() => {
    iwpcWindow?.register(PROCEDURES.INCREMENT_COUNTER, incrementCounter);
    return () => {
      iwpcWindow?.unregister(PROCEDURES.INCREMENT_COUNTER);
    };
  }, [iwpcWindow, incrementCounter]);

  return (
    <WindowFrame
      title='Counter — Child'
      role='Child'
      transport='BroadcastChannel'
      windowId={iwpcWindow?.windowId}
      parentId={iwpcWindow?.parentWindowId}
      status={iwpcWindow?.parentIwpcWindow ? 'connected' : 'connecting'}
    >
      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Shared counter</CardTitle>
          <CardDescription>
            Reload this window to see the parent re-ack the same windowId —
            the count resets but the bond is rebuilt automatically.
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
          <Button
            onClick={() =>
              iwpcWindow?.parentIwpcWindow?.invoke(
                PROCEDURES.INCREMENT_COUNTER,
                undefined
              )
            }
            disabled={!iwpcWindow?.parentIwpcWindow}
          >
            <Plus className='size-4' />
            Increment parent remotely
          </Button>
        </CardContent>
      </Card>

      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
          <CardDescription>
            <code className='font-mono'>dispose()</code> tears down the IWPC
            wiring but leaves the window open;
            <code className='font-mono'> close()</code> also closes the window.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap items-center gap-2'>
          <Button
            variant='outline'
            onClick={() => iwpcWindow?.dispose()}
            disabled={!iwpcWindow}
          >
            <Power className='size-4' />
            dispose()
          </Button>
          <Button
            variant='destructive'
            onClick={() => iwpcWindow?.close()}
            disabled={!iwpcWindow}
          >
            <X className='size-4' />
            close()
          </Button>
        </CardContent>
      </Card>
    </WindowFrame>
  );
}
