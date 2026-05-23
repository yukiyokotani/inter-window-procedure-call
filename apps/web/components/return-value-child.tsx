'use client';

import {
  type IwpcOptions,
  IwpcWindow,
  useIwpcReady
} from '@silurus/iwpc';
import { AlertTriangle, Check, Send, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WindowFrame } from '@/components/window-frame';
import { PROCEDURES } from '@/lib/procedures';
import { readinessToStatus } from '@/lib/readiness';

type Transport = NonNullable<IwpcOptions['transport']>;

type Kind = 'color' | 'confirm' | 'text';

const KIND_TITLE: Record<Kind, string> = {
  color: 'Pick a color',
  confirm: 'Confirm action',
  text: 'Enter text'
};

const SWATCHES = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899'
];

type Props = {
  transport: Transport;
  transportLabel: 'postMessage' | 'BroadcastChannel';
};

type Pending =
  | { kind: 'color'; resolve: (v: string | null) => void }
  | { kind: 'confirm'; message: string; resolve: (v: boolean) => void }
  | { kind: 'text'; prompt: string; resolve: (v: string | null) => void };

export function ReturnValueChildBody({ transport, transportLabel }: Props) {
  const [iwpc, setIwpc] = useState<IwpcWindow>();
  const [kind, setKind] = useState<Kind | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const readiness = useIwpcReady(iwpc);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const k = params.get('kind');
    const validKind: Kind | null =
      k === 'color' || k === 'confirm' || k === 'text' ? k : null;
    setKind(validKind);

    const instance = new IwpcWindow(window, { transport, debug: true });

    // CRITICAL: register the procedure BEFORE initialize(). The parent's
    // invoke() fires the moment open() resolves, so if we wait for a
    // separate useEffect to do the registration we lose the race and the
    // child responds with "Procedure not registered".
    if (validKind === 'color') {
      instance.register<void, string | null>(
        PROCEDURES.PICK_COLOR,
        () =>
          new Promise<string | null>((resolve) => {
            setPending({ kind: 'color', resolve });
          })
      );
    } else if (validKind === 'confirm') {
      instance.register<{ message?: string } | undefined, boolean>(
        PROCEDURES.CONFIRM_ACTION,
        (args) =>
          new Promise<boolean>((resolve) => {
            setPending({
              kind: 'confirm',
              message: args?.message ?? 'Are you sure you want to continue?',
              resolve
            });
          })
      );
    } else if (validKind === 'text') {
      instance.register<{ prompt?: string } | undefined, string | null>(
        PROCEDURES.ENTER_TEXT,
        (args) =>
          new Promise<string | null>((resolve) => {
            setPending({
              kind: 'text',
              prompt: args?.prompt ?? 'What is your name?',
              resolve
            });
          })
      );
    }

    instance.initialize();
    setIwpc(instance);
    return () => {
      instance.dispose();
    };
  }, [transport]);

  const settle = useCallback(
    <T,>(resolve: (v: T) => void, value: T) => {
      resolve(value);
      setPending(null);
      // Let the RETURN message flush before tearing down this window.
      window.setTimeout(() => iwpc?.close(), 120);
    },
    [iwpc]
  );

  return (
    <WindowFrame
      title={kind ? KIND_TITLE[kind] : 'Remote dialog'}
      role='Child'
      transport={transportLabel}
      windowId={iwpc?.windowId}
      parentId={iwpc?.parentWindowId}
      status={readinessToStatus(readiness)}
    >
      {kind === null ? (
        <UnknownKindCard />
      ) : kind === 'color' ? (
        <ColorPickerCard
          pending={pending?.kind === 'color' ? pending : null}
          onPick={(v) => {
            if (pending?.kind === 'color') settle(pending.resolve, v);
          }}
        />
      ) : kind === 'confirm' ? (
        <ConfirmDialogCard
          pending={pending?.kind === 'confirm' ? pending : null}
          onSettle={(v) => {
            if (pending?.kind === 'confirm') settle(pending.resolve, v);
          }}
        />
      ) : (
        <TextPromptCard
          pending={pending?.kind === 'text' ? pending : null}
          onSettle={(v) => {
            if (pending?.kind === 'text') settle(pending.resolve, v);
          }}
        />
      )}
    </WindowFrame>
  );
}

function ColorPickerCard({
  pending,
  onPick
}: {
  pending: { kind: 'color' } | null;
  onPick: (hex: string | null) => void;
}) {
  const isPending = pending !== null;
  return (
    <Card className='bg-card/60 backdrop-blur'>
      <CardHeader>
        <CardTitle>Pick a color</CardTitle>
        <CardDescription>
          Click any swatch — the hex string is returned to the parent
          window&apos;s <code className='font-mono'>await invoke()</code> call.
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-5'>
        <WaitingHint isPending={isPending} />
        <div className='grid grid-cols-4 gap-3 sm:grid-cols-8'>
          {SWATCHES.map((hex) => (
            <button
              key={hex}
              type='button'
              disabled={!isPending}
              onClick={() => onPick(hex)}
              className='group relative aspect-square rounded-lg ring-1 ring-inset ring-border transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50'
              style={{ backgroundColor: hex }}
              aria-label={hex}
            >
              <span className='pointer-events-none absolute inset-x-0 -bottom-5 text-center font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100'>
                {hex}
              </span>
            </button>
          ))}
        </div>
        <div className='flex justify-end'>
          <Button
            variant='outline'
            onClick={() => onPick(null)}
            disabled={!isPending}
          >
            <X className='size-4' />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmDialogCard({
  pending,
  onSettle
}: {
  pending: { kind: 'confirm'; message: string } | null;
  onSettle: (v: boolean) => void;
}) {
  const isPending = pending !== null;
  const message =
    pending?.message ?? 'Are you sure you want to continue?';
  return (
    <Card className='bg-card/60 backdrop-blur'>
      <CardHeader>
        <CardTitle>Confirm action</CardTitle>
        <CardDescription>
          The parent passed a message as an argument. The child returns a
          boolean.
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-6'>
        <WaitingHint isPending={isPending} />
        <div className='flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4'>
          <AlertTriangle className='mt-0.5 size-5 shrink-0 text-amber-400' />
          <p className='text-sm leading-relaxed text-foreground/90'>
            {message}
          </p>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <Button
            variant='outline'
            onClick={() => onSettle(false)}
            disabled={!isPending}
          >
            <X className='size-4' />
            Cancel
          </Button>
          <Button onClick={() => onSettle(true)} disabled={!isPending}>
            <Check className='size-4' />
            Confirm
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TextPromptCard({
  pending,
  onSettle
}: {
  pending: { kind: 'text'; prompt: string } | null;
  onSettle: (v: string | null) => void;
}) {
  const isPending = pending !== null;
  const prompt = pending?.prompt ?? 'What is your name?';
  const [value, setValue] = useState('');
  return (
    <Card className='bg-card/60 backdrop-blur'>
      <CardHeader>
        <CardTitle>Enter text</CardTitle>
        <CardDescription>
          The parent supplies a prompt; the child returns the entered
          string (or <code className='font-mono'>null</code> on cancel).
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-5'>
        <WaitingHint isPending={isPending} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isPending) onSettle(value);
          }}
          className='flex flex-col gap-3'
        >
          <label className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
            {prompt}
          </label>
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!isPending}
          />
          <div className='flex items-center justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onSettle(null)}
              disabled={!isPending}
            >
              <X className='size-4' />
              Cancel
            </Button>
            <Button type='submit' disabled={!isPending || value.length === 0}>
              <Send className='size-4' />
              Submit
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function WaitingHint({ isPending }: { isPending: boolean }) {
  const text = useMemo(
    () =>
      isPending
        ? 'Parent is awaiting your response…'
        : 'Waiting for the parent to invoke this dialog.',
    [isPending]
  );
  return (
    <p className='text-xs text-muted-foreground'>
      <span
        className={
          isPending
            ? 'inline-block size-1.5 rounded-full bg-emerald-400 me-2 align-middle'
            : 'inline-block size-1.5 rounded-full bg-muted-foreground/50 me-2 align-middle'
        }
      />
      {text}
    </p>
  );
}

function UnknownKindCard() {
  return (
    <Card className='bg-card/60 backdrop-blur'>
      <CardHeader>
        <CardTitle>Unknown kind</CardTitle>
        <CardDescription>
          This window expects <code className='font-mono'>?kind=color</code>,
          <code className='font-mono'> ?kind=confirm</code>, or
          <code className='font-mono'> ?kind=text</code> in the URL.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
