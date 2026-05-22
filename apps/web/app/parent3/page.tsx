'use client';

import { ReturnValueParentBody } from '@/components/return-value-parent';

const PARENT_SNIPPET = `// Parent: open the popup and await a typed value.
// The BroadcastChannel transport opens the child with \`noopener\`, so the
// child runs on its OWN event loop — a busy parent does not freeze the
// dialog and vice versa.
const child = await iwpc.open(\`./child3?kind=color\`, {
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
  // Let the RETURN message flush over BroadcastChannel, then tear down.
  setTimeout(() => iwpc?.close(), 120);
};`;

export default function Page() {
  return (
    <ReturnValueParentBody
      transport='broadcastChannel'
      transportLabel='BroadcastChannel'
      childRoute='./child3'
      parentSnippet={PARENT_SNIPPET}
      childSnippet={CHILD_SNIPPET}
      intro={
        <>
          Same return-value pattern as the postMessage demo, but the popup
          opens with <code className='font-mono'>noopener</code> — it runs on
          its <strong className='font-semibold text-foreground'>own event loop</strong>,
          so a long-running task in the parent never freezes the dialog. The
          real advantage of this transport is this thread isolation, not the
          call shape itself.
        </>
      }
    />
  );
}
