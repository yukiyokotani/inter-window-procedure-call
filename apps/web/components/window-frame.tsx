'use client';

import { AppWindow, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'connecting' | 'connected' | 'disconnected';

type WindowFrameProps = {
  title: string;
  role: 'Parent' | 'Child';
  transport: 'postMessage' | 'BroadcastChannel';
  windowId?: string;
  parentId?: string;
  status?: Status;
  children: ReactNode;
};

const transportColor: Record<WindowFrameProps['transport'], string> = {
  postMessage: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  BroadcastChannel: 'bg-violet-500/15 text-violet-300 ring-violet-500/30'
};

export function WindowFrame({
  title,
  role,
  transport,
  windowId,
  parentId,
  status = 'connecting',
  children
}: WindowFrameProps) {
  return (
    <div className='relative min-h-screen w-full overflow-hidden bg-background'>
      <div className='absolute inset-0 bg-grid opacity-30' />
      <div className='absolute inset-0 bg-radial-fade' />
      <div className='relative mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-10'>
        <header className='flex flex-col gap-3'>
          <div className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2 text-muted-foreground'>
              <AppWindow className='size-4' />
              <span className='text-xs uppercase tracking-widest'>
                {role} window
              </span>
            </div>
            <ConnectionPill status={status} />
          </div>
          <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
            {title}
          </h1>
          <div className='flex flex-wrap items-center gap-2'>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                transportColor[transport]
              )}
            >
              {transport}
            </span>
            <IdChip label='windowId' value={windowId} />
            {role === 'Child' && (
              <IdChip label='parentId' value={parentId} />
            )}
          </div>
        </header>
        <main className='flex flex-col gap-4'>{children}</main>
      </div>
    </div>
  );
}

function ConnectionPill({ status }: { status: Status }) {
  if (status === 'connecting') {
    return (
      <Badge variant='secondary' className='gap-1.5'>
        <Loader2 className='size-3 animate-spin' />
        Connecting…
      </Badge>
    );
  }
  if (status === 'connected') {
    return (
      <Badge variant='success' className='gap-1.5'>
        <Wifi className='size-3' />
        Connected
      </Badge>
    );
  }
  return (
    <Badge variant='destructive' className='gap-1.5'>
      <WifiOff className='size-3' />
      Disconnected
    </Badge>
  );
}

function IdChip({ label, value }: { label: string; value?: string }) {
  return (
    <span className='inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground'>
      <span className='text-muted-foreground/60'>{label}</span>
      <span className='text-foreground/90'>
        {value ?? <span className='text-muted-foreground'>—</span>}
      </span>
    </span>
  );
}
