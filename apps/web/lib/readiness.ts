export type Readiness = 'pending' | 'ready' | 'failed';

export function readinessToStatus(
  readiness: Readiness
): 'connecting' | 'connected' | 'disconnected' {
  if (readiness === 'ready') return 'connected';
  if (readiness === 'failed') return 'disconnected';
  return 'connecting';
}
