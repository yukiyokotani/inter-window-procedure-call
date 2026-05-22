'use client';

import { useIwpcWindow } from '@silurus/iwpc';
import { AlertTriangle, Check, Send, X } from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

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

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Child3 />
    </Suspense>
  );
}

function Child3() {
  const iwpcWindow = useIwpcWindow({
    debug: true,
    transport: 'broadcastChannel'
  });
  const kind = useKind();

  return (
    <WindowFrame
      title={kind ? KIND_TITLE[kind] : 'Remote dialog'}
      role='Child'
      transport='BroadcastChannel'
      windowId={iwpcWindow?.windowId}
      parentId={iwpcWindow?.parentWindowId}
      status={iwpcWindow?.parentIwpcWindow ? 'connected' : 'connecting'}
    >
      {kind === null ? (
        <UnknownKindCard />
      ) : kind === 'color' ? (
        <ColorPicker iwpc={iwpcWindow} />
      ) : kind === 'confirm' ? (
        <ConfirmDialog iwpc={iwpcWindow} />
      ) : (
        <TextPrompt iwpc={iwpcWindow} />
      )}
    </WindowFrame>
  );
}

function useKind(): Kind | null {
  const [kind, setKind] = useState<Kind | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('kind');
    if (value === 'color' || value === 'confirm' || value === 'text') {
      setKind(value);
    }
  }, []);
  return kind;
}

type IwpcLike = ReturnType<typeof useIwpcWindow>;

function usePendingResolver<T>(
  iwpc: IwpcLike,
  procedureId: string
): {
  isPending: boolean;
  resolve: (value: T) => void;
} {
  const resolverRef = useRef<((value: T) => void) | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!iwpc) return;
    iwpc.register(procedureId, () => {
      setIsPending(true);
      return new Promise<T>((resolve) => {
        resolverRef.current = resolve;
      });
    });
    return () => {
      iwpc.unregister(procedureId);
    };
  }, [iwpc, procedureId]);

  const resolve = useCallback(
    (value: T) => {
      if (!resolverRef.current) return;
      resolverRef.current(value);
      resolverRef.current = null;
      setIsPending(false);
      // Let the RETURN message flush over BroadcastChannel before tearing
      // down this window.
      window.setTimeout(() => iwpc?.close(), 120);
    },
    [iwpc]
  );

  return { isPending, resolve };
}

function ColorPicker({ iwpc }: { iwpc: IwpcLike }) {
  const { isPending, resolve } = usePendingResolver<string | null>(
    iwpc,
    PROCEDURES.PICK_COLOR
  );

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
              onClick={() => resolve(hex)}
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
            onClick={() => resolve(null)}
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

function ConfirmDialog({ iwpc }: { iwpc: IwpcLike }) {
  const [message, setMessage] = useState<string>(
    'Are you sure you want to continue?'
  );
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!iwpc) return;
    iwpc.register(
      PROCEDURES.CONFIRM_ACTION,
      (args: { message?: string } | undefined) => {
        if (typeof args?.message === 'string' && args.message.length > 0) {
          setMessage(args.message);
        }
        setIsPending(true);
        return new Promise<boolean>((resolve) => {
          resolverRef.current = resolve;
        });
      }
    );
    return () => {
      iwpc.unregister(PROCEDURES.CONFIRM_ACTION);
    };
  }, [iwpc]);

  const settle = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setIsPending(false);
    window.setTimeout(() => iwpc?.close(), 120);
  };

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
            onClick={() => settle(false)}
            disabled={!isPending}
          >
            <X className='size-4' />
            Cancel
          </Button>
          <Button onClick={() => settle(true)} disabled={!isPending}>
            <Check className='size-4' />
            Confirm
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TextPrompt({ iwpc }: { iwpc: IwpcLike }) {
  const [prompt, setPrompt] = useState<string>('What is your name?');
  const [value, setValue] = useState('');
  const resolverRef = useRef<((value: string | null) => void) | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!iwpc) return;
    iwpc.register(
      PROCEDURES.ENTER_TEXT,
      (args: { prompt?: string } | undefined) => {
        if (typeof args?.prompt === 'string' && args.prompt.length > 0) {
          setPrompt(args.prompt);
        }
        setIsPending(true);
        return new Promise<string | null>((resolve) => {
          resolverRef.current = resolve;
        });
      }
    );
    return () => {
      iwpc.unregister(PROCEDURES.ENTER_TEXT);
    };
  }, [iwpc]);

  const settle = (v: string | null) => {
    resolverRef.current?.(v);
    resolverRef.current = null;
    setIsPending(false);
    window.setTimeout(() => iwpc?.close(), 120);
  };

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
            if (isPending) settle(value);
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
              onClick={() => settle(null)}
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
