'use client';

import { ReturnValueParentBody } from '@/components/return-value-parent';

const PARENT_SNIPPET = `// Parent: open the popup and await a typed value.
// The postMessage transport keeps \`window.opener\` wired up, so the
// parent and child share an event loop. Same call shape as the
// BroadcastChannel demo — only the option differs.
const child = await iwpc.open(\`./child?kind=color\`, {
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

const CHILD_SNIPPET = `// Child: register BEFORE initialize() so the parent's invoke
// (which fires the moment open() resolves) finds the handler.
const instance = new IwpcWindow(window);

instance.register('PICK_COLOR', () =>
  new Promise<string | null>((resolve) => {
    // Resolve from a button click handler in the UI.
    setPending({ kind: 'color', resolve });
  })
);

instance.initialize();`;

export default function Page() {
  return (
    <ReturnValueParentBody
      transport='postMessage'
      transportLabel='postMessage'
      childRoute='./child'
      parentSnippet={PARENT_SNIPPET}
      childSnippet={CHILD_SNIPPET}
      intro={
        <>
          The return-value pattern over the legacy{' '}
          <code className='font-mono'>postMessage</code> transport. The call
          shape is identical to the BroadcastChannel demo — what differs is
          that{' '}
          <strong className='font-semibold text-foreground'>
            the child shares the parent&apos;s event loop
          </strong>
          . Pick this transport when you want the simplest setup; pick
          BroadcastChannel when the child runs alongside a busy parent.
        </>
      }
    />
  );
}
