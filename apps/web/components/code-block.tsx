'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type CodeBlockProps = {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
};

function inferLang(filename: string | undefined, fallback: string): string {
  if (!filename) return fallback;
  const ext = filename.split('.').pop();
  if (!ext) return fallback;
  if (ext === 'ts') return 'ts';
  if (ext === 'tsx') return 'tsx';
  if (ext === 'js') return 'js';
  if (ext === 'jsx') return 'jsx';
  return fallback;
}

export function CodeBlock({
  code,
  language,
  filename,
  className
}: CodeBlockProps) {
  const lang = language ?? inferLang(filename, 'tsx');
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { codeToHtml } = await import('shiki');
        const result = await codeToHtml(code, {
          lang,
          theme: 'github-dark-default'
        });
        if (!cancelled) setHtml(result);
      } catch {
        /* leave the plain fallback in place */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

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
          {filename ?? lang}
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
      {html ? (
        <div
          className='code-shiki overflow-x-auto p-4'
          // shiki output is sanitized to a known shape; rendering as HTML is safe.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className='overflow-x-auto p-4 text-foreground/90'>
          <code>{code}</code>
        </pre>
      )}
    </figure>
  );
}
