export function messageEventSourceIsWindow(
  source: MessageEventSource
): source is Window {
  return (
    (!('MessagePort' in window) || !(source instanceof MessagePort)) &&
    (!('ServiceWorker' in window) || !(source instanceof ServiceWorker)) &&
    !!source.postMessage
  );
}
