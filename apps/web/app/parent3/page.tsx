'use client';

import { useIwpcWindow } from '@silurus/iwpc/index';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Palette,
  TypeOutline,
  X
} from 'lucide-react';
import { useCallback, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { WindowFrame } from '@/components/window-frame';
import { PROCEDURES } from '@/lib/procedures';

type Result =
  | { kind: 'color'; value: string | null }
  | { kind: 'confirm'; value: boolean }
  | { kind: 'text'; value: string | null }
  | { kind: 'error'; value: string };

const OPEN_OPTS = { width: 520, height: 540, top: 80, left: 720 } as const;
// Generous timeout so the user has time to interact with the popup.
const DIALOG_TIMEOUT_MS = 5 * 60 * 1000;

export default function Page() {
  const iwpcWindow = useIwpcWindow({
    debug: true,
    transport: 'broadcastChannel'
  });
  const [busy, setBusy] = useState<null | 'color' | 'confirm' | 'text'>(null);
  const [result, setResult] = useState<Result | null>(null);

  const runRemote = useCallback(
    async <T,>(
      kind: 'color' | 'confirm' | 'text',
      procedureId: string,
      args: unknown
    ): Promise<T | undefined> => {
      if (!iwpcWindow) return undefined;
      setBusy(kind);
      setResult(null);
      try {
        const child = await iwpcWindow.open(`./child3?kind=${kind}`, OPEN_OPTS);
        if (!child) {
          setResult({ kind: 'error', value: 'Failed to open child window.' });
          return undefined;
        }
        const value = await child.invoke<unknown, T>(procedureId, args, {
          timeout: DIALOG_TIMEOUT_MS
        });
        return value;
      } catch (e) {
        setResult({
          kind: 'error',
          value: e instanceof Error ? e.message : String(e)
        });
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [iwpcWindow]
  );

  return (
    <WindowFrame
      title='Async return values'
      role='Parent'
      transport='BroadcastChannel'
      windowId={iwpcWindow?.windowId}
      status={iwpcWindow ? 'connected' : 'connecting'}
    >
      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>The return-value pattern</CardTitle>
          <CardDescription>
            Each button opens a popup, awaits a typed value from the
            child&apos;s registered procedure, and closes the popup. Cancel
            from the child to resolve with <code className='font-mono'>null</code>{' '}
            or <code className='font-mono'>false</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          <RemoteAction
            label='Pick a color'
            icon={<Palette className='size-4' />}
            tone='violet'
            disabled={!iwpcWindow || busy !== null}
            busy={busy === 'color'}
            onClick={async () => {
              const value = await runRemote<string | null>(
                'color',
                PROCEDURES.PICK_COLOR,
                undefined
              );
              if (value !== undefined) setResult({ kind: 'color', value });
            }}
          />
          <RemoteAction
            label='Confirm an action'
            icon={<AlertTriangle className='size-4' />}
            tone='amber'
            disabled={!iwpcWindow || busy !== null}
            busy={busy === 'confirm'}
            onClick={async () => {
              const value = await runRemote<boolean>(
                'confirm',
                PROCEDURES.CONFIRM_ACTION,
                { message: 'Delete every file in /tmp?' }
              );
              if (value !== undefined) setResult({ kind: 'confirm', value });
            }}
          />
          <RemoteAction
            label='Enter your name'
            icon={<TypeOutline className='size-4' />}
            tone='sky'
            disabled={!iwpcWindow || busy !== null}
            busy={busy === 'text'}
            onClick={async () => {
              const value = await runRemote<string | null>(
                'text',
                PROCEDURES.ENTER_TEXT,
                { prompt: 'What should we call you?' }
              );
              if (value !== undefined) setResult({ kind: 'text', value });
            }}
          />
        </CardContent>
      </Card>

      <Card className='bg-card/60 backdrop-blur'>
        <CardHeader>
          <CardTitle>Last result</CardTitle>
          <CardDescription>
            Whatever the child popup most recently returned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResultDisplay result={result} />
        </CardContent>
      </Card>
    </WindowFrame>
  );
}

type Tone = 'violet' | 'amber' | 'sky';

const TONE_RING: Record<Tone, string> = {
  violet: 'hover:ring-violet-500/30',
  amber: 'hover:ring-amber-500/30',
  sky: 'hover:ring-sky-500/30'
};

function RemoteAction({
  label,
  icon,
  tone,
  disabled,
  busy,
  onClick
}: {
  label: string;
  icon: React.ReactNode;
  tone: Tone;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-col items-start gap-3 rounded-lg border border-border bg-background/40 p-4 text-left ring-1 ring-inset ring-transparent transition-all hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-50 ${TONE_RING[tone]}`}
    >
      <div className='flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground/80'>
        {icon}
      </div>
      <div className='flex w-full items-center justify-between'>
        <span className='text-sm font-medium'>{label}</span>
        <ExternalLink className='size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
      </div>
      <span className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground'>
        {busy ? 'awaiting…' : 'await invoke()'}
      </span>
    </button>
  );
}

function ResultDisplay({ result }: { result: Result | null }) {
  if (result === null) {
    return (
      <p className='font-mono text-sm text-muted-foreground'>
        // no result yet
      </p>
    );
  }
  if (result.kind === 'error') {
    return (
      <div className='flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground'>
        <AlertTriangle className='size-4 text-destructive' />
        <span className='font-mono'>{result.value}</span>
      </div>
    );
  }
  if (result.kind === 'color') {
    if (result.value === null) return <Cancelled />;
    return (
      <div className='flex items-center gap-4 rounded-lg border border-border bg-background/50 p-4'>
        <div
          className='size-12 shrink-0 rounded-md ring-1 ring-inset ring-border'
          style={{ backgroundColor: result.value }}
        />
        <div className='flex flex-col'>
          <span className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
            color
          </span>
          <span className='font-mono text-lg text-foreground'>
            {result.value}
          </span>
        </div>
      </div>
    );
  }
  if (result.kind === 'confirm') {
    const ok = result.value;
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border p-4 ${
          ok
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-border bg-background/50'
        }`}
      >
        {ok ? (
          <Check className='size-5 text-emerald-400' />
        ) : (
          <X className='size-5 text-muted-foreground' />
        )}
        <span className='font-mono text-sm'>
          {ok ? 'true (confirmed)' : 'false (cancelled)'}
        </span>
      </div>
    );
  }
  // text
  if (result.value === null) return <Cancelled />;
  return (
    <div className='flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-4'>
      <span className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
        text
      </span>
      <blockquote className='border-l-2 border-border ps-3 font-mono text-base text-foreground'>
        {result.value}
      </blockquote>
    </div>
  );
}

function Cancelled() {
  return (
    <div className='flex items-center gap-3 rounded-lg border border-border bg-background/50 p-4'>
      <X className='size-5 text-muted-foreground' />
      <span className='font-mono text-sm text-muted-foreground'>
        null (cancelled)
      </span>
    </div>
  );
}
