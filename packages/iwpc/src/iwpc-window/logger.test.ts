import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger } from './logger';

type ConsoleMethod = 'debug' | 'log' | 'warn' | 'error';
type LoggerMethod = '_debug' | '_log' | '_warn' | '_error';

const CASES: ReadonlyArray<{ loggerMethod: LoggerMethod; consoleMethod: ConsoleMethod }> =
  [
    { loggerMethod: '_debug', consoleMethod: 'debug' },
    { loggerMethod: '_log', consoleMethod: 'log' },
    { loggerMethod: '_warn', consoleMethod: 'warn' },
    { loggerMethod: '_error', consoleMethod: 'error' }
  ];

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Logger', () => {
  let spies: Record<ConsoleMethod, ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    spies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => undefined),
      log: vi.spyOn(console, 'log').mockImplementation(() => undefined),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      error: vi.spyOn(console, 'error').mockImplementation(() => undefined)
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when enabled', () => {
    it.each(CASES)(
      '$loggerMethod forwards to console.$consoleMethod',
      ({ loggerMethod, consoleMethod }) => {
        const logger = new Logger(true);
        logger[loggerMethod]('hello', 42);
        expect(spies[consoleMethod]).toHaveBeenCalledTimes(1);
      }
    );

    it('prefixes an ISO-8601 timestamp followed by the original arguments', () => {
      const logger = new Logger(true);
      logger._log('payload', { a: 1 });

      expect(spies.log).toHaveBeenCalledTimes(1);
      const args = spies.log.mock.calls[0]!;
      expect(args[0]).toMatch(ISO_8601);
      expect(args.slice(1)).toEqual(['payload', { a: 1 }]);
    });

    it('still emits the timestamp when called with no message arguments', () => {
      const logger = new Logger(true);
      logger._debug();

      expect(spies.debug).toHaveBeenCalledTimes(1);
      const args = spies.debug.mock.calls[0]!;
      expect(args).toHaveLength(1);
      expect(args[0]).toMatch(ISO_8601);
    });
  });

  describe('when disabled', () => {
    it.each(CASES)('$loggerMethod is silent', ({ loggerMethod, consoleMethod }) => {
      const logger = new Logger(false);
      logger[loggerMethod]('should not appear');
      expect(spies[consoleMethod]).not.toHaveBeenCalled();
    });
  });
});
