'use client';

import { ReturnValueParentBody } from '@/components/return-value-parent';

const PARENT_SNIPPET = `// Parent: open the popup and await a typed value.
// The postMessage transport keeps \`window.opener\` wired up, so the
// parent and child share an agent cluster and an event loop. Same shape
// as the BroadcastChannel demo — only the option differs.
const child = await iwpc.open(\`./child4?kind=color\`, {
  width: 520,
  height: 540
});

const hex = await child.invoke<void, string | null>(
  'PICK_COLOR',
  undefined,
  { timeout: 5 * 60 * 1000 } // generous, the user is in the loop
);

if (hex === null) {
  // user cancelled
} else {
  setColor(hex);
}`;

const CHILD_SNIPPET = `// Child: turn a user interaction into a procedure return value.
// Identical to the BroadcastChannel child — the call shape is the same.
const resolverRef = useRef<((v: string | null) => void) | null>(null);

useEffect(() => {
  iwpc?.register('PICK_COLOR', () => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  });
  return () => iwpc?.unregister('PICK_COLOR');
}, [iwpc]);

const onPick = (hex: string) => {
  resolverRef.current?.(hex);
  resolverRef.current = null;
  setTimeout(() => iwpc?.close(), 120);
};`;

export default function Page() {
  return (
    <ReturnValueParentBody
      transport='postMessage'
      transportLabel='postMessage'
      childRoute='./child4'
      parentSnippet={PARENT_SNIPPET}
      childSnippet={CHILD_SNIPPET}
      intro={
        <>
          The return-value pattern over the legacy{' '}
          <code className='font-mono'>postMessage</code> transport. The call
          shape is identical to the BroadcastChannel demo — what differs is
          that <strong className='font-semibold text-foreground'>the child shares
          the parent&apos;s event loop</strong>. Pick this transport when you
          want the simplest setup and the windows are short-lived; pick
          BroadcastChannel when the child runs alongside a busy parent.
        </>
      }
    />
  );
}
