'use client';

import {
  type IwpcOptions,
  IwpcWindowAgent,
  useIwpcReady,
  useIwpcWindow
} from '@silurus/iwpc';
import { ExternalLink, Megaphone } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

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
import { readinessToStatus } from '@/lib/readiness';

type Transport = NonNullable<IwpcOptions['transport']>;

type Props = {
  transport: Transport;
  transportLabel: 'postMessage' | 'BroadcastChannel';
  intro: React.ReactNode;
  snippet: string;
};

const OPEN_OPTS = { width: 480, height: 460 };

export function FanoutParentBody({
  transport,
  transportLabel,
  intro,
  snippet
}: Props) {
  const iwpcWindow = useIwpcWindow({ debug: true, transport });
  const readiness = useIwpcReady(iwpcWindow);
  const [children, setChildren] = useState<IwpcWindowAgent[]>([]);
  const [broadcastCount, setBroadcastCount] = useState(0);
  const seq = useRef(0);

  const openChild = useCallback(async () => {
    if (!iwpcWindow) return;
    seq.current += 1;
    const offset = (seq.current - 1) * 24;
    try {
      const agent = await iwpcWindow.open('./child', {
        ...OPEN_OPTS,
        top: 80 + offset,
        left: 720 + offset
      });
      if (agent) setChildren((prev) => [...prev, agent]);
    } catch (e) {
      console.error(e);
    }
  }, [iwpcWindow]);

  const broadcastIncrement = useCallback(() => {
    if (!iwpcWindow) return;
    iwpcWindow.broadcast(PROCEDURES.INCREMENT_COUNTER);
    setBroadcastCount((c) => c + 1);
  }, [iwpcWindow]);

  return (
    <WindowFrame
      title='Broadcast to all'
      role='Parent'
      transport={transportLabel}
      windowId={iwpcWindow?.windowId}
      status={readinessToStatus(readiness)}
    >
      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>One-to-many</CardTitle>
          <CardDescription>{intro}</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-6'>
          <div className='flex items-center justify-between rounded-lg border border-border bg-background/50 p-6'>
            <div className='flex flex-col gap-1'>
              <span className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
                Children open
              </span>
              <span className='font-mono text-3xl font-semibold tabular-nums'>
                {children.length}
              </span>
            </div>
            <div className='flex flex-col gap-1 text-right'>
              <span className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
                Broadcasts sent
              </span>
              <span className='font-mono text-3xl font-semibold tabular-nums'>
                {broadcastCount}
              </span>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button onClick={openChild} disabled={!iwpcWindow}>
              <ExternalLink className='size-4' />
              Open another child
            </Button>
            <Button
              variant='outline'
              onClick={broadcastIncrement}
              disabled={!iwpcWindow || children.length === 0}
            >
              <Megaphone className='size-4' />
              Broadcast +1 to ALL children
            </Button>
          </div>
          <p className='text-xs text-muted-foreground'>
            Open several popups, arrange them so you can see all of them,
            and click <em>Broadcast</em>. Every child counter ticks up
            from the same call.
          </p>
        </CardContent>
      </Card>

      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Code</CardTitle>
          <CardDescription>
            One <code className='font-mono'>broadcast()</code> on the parent,
            same handler on every child.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={snippet} filename='broadcast.tsx' />
        </CardContent>
      </Card>
    </WindowFrame>
  );
}
