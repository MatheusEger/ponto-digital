// lib/writeQueue.ts
// Serializes writes within a single invocation (in-process chain).
// Cross-invocation serialization is handled by SQLite transactions (BEGIN IMMEDIATE)
// inside the critical sections that need it.

let chain: Promise<unknown> = Promise.resolve();

export function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(() => fn());
  chain = next.catch(() => undefined);
  return next;
}
