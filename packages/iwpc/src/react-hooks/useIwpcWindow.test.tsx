import { act, render } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { IwpcWindow } from '../iwpc-window/iwpcWindow';

import { useIwpcWindow } from './useIwpcWindow';

/**
 * A render-tap that exposes the latest hook return value to the test.
 */
function Harness({
  options,
  onValue
}: {
  options?: Parameters<typeof useIwpcWindow>[0];
  onValue: (value: ReturnType<typeof useIwpcWindow>) => void;
}) {
  const value = useIwpcWindow(options);
  useEffect(() => {
    onValue(value);
  });
  return null;
}

const renders: ReturnType<typeof render>[] = [];

afterEach(() => {
  while (renders.length) renders.pop()?.unmount();
});

function tracked(r: ReturnType<typeof render>) {
  renders.push(r);
  return r;
}

describe('useIwpcWindow', () => {
  it('returns undefined on the first render, then an IwpcWindow once mounted', async () => {
    const seen: Array<unknown> = [];
    tracked(render(<Harness onValue={(v) => seen.push(v)} />));
    await waitForEffect();
    expect(seen[0]).toBeUndefined();
    expect(seen.at(-1)).toBeInstanceOf(IwpcWindow);
  });

  it('survives React StrictMode mount → unmount → remount without permanently disposing', async () => {
    const seen: Array<IwpcWindow | undefined> = [];
    tracked(
      render(
        <StrictMode>
          <Harness onValue={(v) => seen.push(v)} />
        </StrictMode>
      )
    );
    await waitForEffect();

    const last = seen.at(-1);
    expect(last).toBeInstanceOf(IwpcWindow);
    // The remount cycle must leave us with a live (non-disposed) instance.
    await expect((last as IwpcWindow).ready).resolves.toBe(true);
  });

  it('passes the options object through to the underlying IwpcWindow (transport)', async () => {
    const seen: Array<IwpcWindow | undefined> = [];
    tracked(
      render(
        <Harness
          options={{ transport: 'broadcastChannel' }}
          onValue={(v) => seen.push(v)}
        />
      )
    );
    await waitForEffect();
    const instance = seen.at(-1);
    expect(instance).toBeInstanceOf(IwpcWindow);
    expect((instance as IwpcWindow).transport).toBe('broadcastChannel');
  });

  it('disposes the instance on unmount so that further open() rejects', async () => {
    let captured: IwpcWindow | undefined;
    const r = tracked(
      render(<Harness onValue={(v) => (captured = v ?? captured)} />)
    );
    await waitForEffect();
    expect(captured).toBeInstanceOf(IwpcWindow);
    const instance = captured!;

    r.unmount();
    renders.pop();

    await expect(instance.open('/x')).rejects.toThrow(/disposed/i);
  });

  it('does not create a new IwpcWindow on every render', async () => {
    const seen: Array<IwpcWindow | undefined> = [];
    function Rerenderer({ tick }: { tick: number }) {
      const iwpc = useIwpcWindow();
      useEffect(() => {
        seen.push(iwpc);
        // suppress unused warning
        void tick;
      });
      return null;
    }
    const r = tracked(render(<Rerenderer tick={0} />));
    await waitForEffect();
    r.rerender(<Rerenderer tick={1} />);
    r.rerender(<Rerenderer tick={2} />);
    await waitForEffect();

    const liveInstances = seen.filter(Boolean) as IwpcWindow[];
    expect(liveInstances.length).toBeGreaterThan(0);
    const first = liveInstances[0];
    for (const inst of liveInstances) {
      expect(inst).toBe(first);
    }
  });
});

async function waitForEffect(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}
