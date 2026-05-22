import { describe, expect, it } from 'vitest';

import {
  INITIALIZATION_TIMEOUT,
  IWPC_PROCESS_TIMEOUT,
  IWPC_WINDOW_ID_QUERY_PARAM
} from './constants';

describe('constants', () => {
  it('uses reasonable positive timeouts', () => {
    expect(INITIALIZATION_TIMEOUT).toBeGreaterThan(0);
    expect(IWPC_PROCESS_TIMEOUT).toBeGreaterThan(0);
  });

  it('namespaces the query-parameter key to avoid clashes with caller URLs', () => {
    expect(IWPC_WINDOW_ID_QUERY_PARAM.startsWith('__iwpc')).toBe(true);
  });
});
