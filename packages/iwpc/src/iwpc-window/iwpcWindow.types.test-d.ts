/**
 * Type-level tests. The file is compiled by tsc but never executed.
 * `expectTypeOf`-style assertions are intentionally written as `satisfies`
 * checks so a regression in the public signatures fails the type check.
 */
import { Topic } from '../topic/topic';

import { IwpcWindow } from './iwpcWindow';
import { IwpcWindowAgent } from './iwpcWindowAgent';
import type { IwpcMessage } from './message';

declare const win: IwpcWindow;

// register: explicit Args / Return arguments narrow the callback signature.
win.register<{ name: string }, string>(
  'GREET',
  (args) => args.name.toUpperCase()
);

// register: a Promise-returning handler is allowed when Return is the
// resolved type.
win.register<number, number>('DOUBLE', async (n) => n * 2);

// register: zero-arg / no-return is the default.
win.register('PING', () => {
  /* no-op */
});

// @ts-expect-error — handler signature mismatch must be caught.
win.register<{ name: string }, string>('GREET', (args: number) => String(args));

// @ts-expect-error — wrong return type must be caught.
win.register<number, string>('STR', (n) => n);

declare const topic: Topic<'IWPC', IwpcMessage>;
declare const agent: IwpcWindowAgent;

// invoke: with explicit Args / Return.
const greeting: Promise<string> = agent.invoke<{ name: string }, string>(
  'GREET',
  { name: 'x' }
);
greeting.then((s) => s.toUpperCase());

// invoke: defaulted Args is `void` — no args required.
agent.invoke<void, void>('PING');

// invoke: third arg is options.
agent.invoke<number, number>('DOUBLE', 21, { timeout: 1000 });

// Suppress unused-vars for the declare-only fixtures.
void topic;
