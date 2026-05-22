'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

type CodeBlockProps = {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
};

export function CodeBlock({
  code,
  language = 'ts',
  filename,
  className
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <figure
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border bg-background/60 font-mono text-[12.5px] leading-relaxed',
        className
      )}
    >
      <div className='flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5'>
        <span className='text-[10px] uppercase tracking-widest text-muted-foreground'>
          {filename ?? language}
        </span>
        <button
          type='button'
          onClick={copy}
          className='inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
        >
          {copied ? (
            <>
              <Check className='size-3' />
              Copied
            </>
          ) : (
            <>
              <Copy className='size-3' />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className='overflow-x-auto p-4 text-foreground/90'>
        <code>{code}</code>
      </pre>
    </figure>
  );
}
