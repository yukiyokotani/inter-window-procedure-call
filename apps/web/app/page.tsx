import { ArrowRight, MessagesSquare, Radio, Repeat } from 'lucide-react';
import Link from 'next/link';

import { CodeBlock } from '@/components/code-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

type Demo = {
  href: string;
  title: string;
  subtitle: string;
  description: string;
  badge: 'postMessage' | 'BroadcastChannel';
  icon: typeof Repeat;
};

const BADGE_CLASS: Record<Demo['badge'], string> = {
  postMessage: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  BroadcastChannel: 'bg-violet-500/15 text-violet-300 ring-violet-500/30'
};

const demos: Demo[] = [
  {
    href: './counter/postmessage',
    title: 'Counter sync',
    subtitle: 'Fire-and-forget RPC',
    description:
      'Each side increments the other. The simplest pattern: register a handler, invoke it from the other window. No return value.',
    badge: 'postMessage',
    icon: Repeat
  },
  {
    href: './counter/broadcast',
    title: 'Counter sync',
    subtitle: 'Fire-and-forget RPC',
    description:
      'Same demo. Child opens with noopener and runs on its own event loop — a busy parent never blocks the child or vice versa.',
    badge: 'BroadcastChannel',
    icon: Radio
  },
  {
    href: './dialog/postmessage',
    title: 'Async return values',
    subtitle: 'await invoke<…, T>()',
    description:
      'Open a child window as a remote dialog and await a typed result — pick a color, confirm, or enter text. Shared event loop with the parent.',
    badge: 'postMessage',
    icon: MessagesSquare
  },
  {
    href: './dialog/broadcast',
    title: 'Async return values',
    subtitle: 'await invoke<…, T>()',
    description:
      'Same dialog flow, but with thread isolation: the popup runs on its own event loop so its UI stays responsive even when the parent is doing heavy work.',
    badge: 'BroadcastChannel',
    icon: MessagesSquare
  }
];

export default function Home() {
  return (
    <div className='relative min-h-screen overflow-hidden'>
      <div className='absolute inset-0 bg-grid opacity-30' />
      <div className='absolute inset-0 bg-radial-fade' />
      <div className='relative mx-auto flex max-w-5xl flex-col gap-16 px-6 py-10 sm:py-16'>
        <Nav />
        <Hero />
        <QuickStart />
        <Demos />
        <Footer />
      </div>
    </div>
  );
}

const QUICK_START = `import { useIwpcWindow } from '@silurus/iwpc';

// Parent
const iwpc = useIwpcWindow();
const child = await iwpc?.open('./child');
const name = await child.invoke<void, string>('ASK_NAME');

// Child
iwpc?.register('ASK_NAME', () => prompt('What is your name?') ?? '');`;

function QuickStart() {
  return (
    <section className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <span className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
          Quick start
        </span>
        <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
          Register on one side. Invoke from the other.
        </h2>
      </div>
      <CodeBlock code={QUICK_START} filename='example.ts' />
    </section>
  );
}

function Nav() {
  return (
    <nav className='flex items-center justify-between'>
      <div className='flex items-center gap-2'>
        <div className='flex size-7 items-center justify-center rounded-md border border-border bg-card font-mono text-[11px] font-semibold tracking-widest text-foreground/80'>
          IW
        </div>
        <span className='font-mono text-sm text-muted-foreground'>
          @silurus/iwpc
        </span>
      </div>
      <Button asChild variant='ghost' size='sm'>
        <Link
          href='https://github.com/yukiyokotani/inter-window-procedure-call'
          target='_blank'
          rel='noopener noreferrer'
        >
          <GithubMark />
          GitHub
        </Link>
      </Button>
    </nav>
  );
}

function Hero() {
  return (
    <section className='flex flex-col items-center gap-6 text-center'>
      <Badge variant='outline' className='gap-1.5'>
        <span className='inline-block size-1.5 rounded-full bg-emerald-400' />
        Type-safe RPC for browser windows
      </Badge>
      <h1 className='max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl'>
        Inter-Window
        <br />
        <span className='bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent'>
          Procedure Call
        </span>
      </h1>
      <p className='max-w-xl text-balance text-base text-muted-foreground sm:text-lg'>
        Talk to popups, child tabs, and detached windows like they were
        local functions. Register on one side, invoke from the other —
        with timeouts, abort signals, and a typed error hierarchy.
      </p>
      <div className='mt-2 flex flex-col items-center gap-3 sm:flex-row'>
        <div className='inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-sm text-foreground/90'>
          <span className='text-muted-foreground'>$</span>
          pnpm add @silurus/iwpc
        </div>
        <Button asChild size='lg' className='gap-2'>
          <Link href='#demos'>
            Try the demos
            <ArrowRight className='size-4' />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Demos() {
  return (
    <section id='demos' className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <span className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
          Demos
        </span>
        <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
          Two patterns, two transports
        </h2>
        <p className='max-w-2xl text-sm text-muted-foreground'>
          Each row is the same demo over two transports. The call shape
          is identical — the difference is what happens to your event loop.
          <br />
          Open the parent and child side by side and watch DevTools for
          verbose logs.
        </p>
      </div>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {demos.map((demo) => (
          <DemoCard key={demo.href} {...demo} />
        ))}
      </div>
      <TransportNote />
    </section>
  );
}

function TransportNote() {
  return (
    <div className='rounded-lg border border-violet-500/20 bg-violet-500/5 p-5'>
      <div className='flex flex-col gap-2'>
        <span className='font-mono text-[11px] uppercase tracking-widest text-violet-300'>
          Why BroadcastChannel?
        </span>
        <p className='text-sm leading-relaxed text-foreground/90'>
          The BroadcastChannel transport opens the child with{' '}
          <code className='font-mono text-foreground'>noopener</code>, so the
          two windows live on{' '}
          <strong className='font-semibold'>independent event loops</strong>.
          Heavy work in one window — a long parse, a layout thrash, a CPU
          spike — does not stall the other. The API surface is identical
          to the postMessage transport; reach for it when the popup needs
          to stay responsive regardless of what the parent is doing.
        </p>
      </div>
    </div>
  );
}

function DemoCard({
  href,
  title,
  subtitle,
  description,
  badge,
  icon: Icon
}: Demo) {
  return (
    <Card className='group flex flex-col overflow-hidden bg-card/40 backdrop-blur transition-colors hover:bg-card/70'>
      <CardHeader className='gap-3'>
        <div className='flex items-center justify-between'>
          <div className='flex size-9 items-center justify-center rounded-md border border-border bg-background'>
            <Icon className='size-4 text-foreground/80' />
          </div>
          <span
            className={
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ' +
              BADGE_CLASS[badge]
            }
          >
            {badge}
          </span>
        </div>
        <div className='flex flex-col gap-1'>
          <CardTitle>{title}</CardTitle>
          <CardDescription className='font-mono text-xs uppercase tracking-wider'>
            {subtitle}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col justify-between gap-4'>
        <p className='text-sm leading-relaxed text-muted-foreground'>
          {description}
        </p>
        <Button asChild variant='outline' className='justify-between'>
          <a href={href} target='_blank' rel='noopener noreferrer'>
            Open demo
            <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function GithubMark() {
  return (
    <svg
      viewBox='0 0 16 16'
      fill='currentColor'
      aria-hidden='true'
      className='size-4'
    >
      <path d='M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.88 2.34.67.07-.52.28-.88.5-1.08-1.78-.2-3.65-.89-3.65-3.96 0-.87.31-1.59.83-2.15-.08-.21-.36-1.03.08-2.15 0 0 .67-.22 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.12.16 1.94.08 2.15.52.56.83 1.28.83 2.15 0 3.08-1.87 3.76-3.65 3.95.29.25.55.74.55 1.5v2.22c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z' />
    </svg>
  );
}

function Footer() {
  return (
    <footer className='flex flex-col items-center gap-2 border-t border-border pt-8 text-xs text-muted-foreground'>
      <span>MIT licensed.</span>
      <span>
        Built with Next.js, Tailwind CSS, and shadcn/ui.
      </span>
    </footer>
  );
}
