// lib/cache.ts
type Entry<T> = { data: T; expiresAt: number; version: number };

const store = new Map<string, Entry<unknown>>();
let globalVersion = 0;

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return undefined;
  if (e.expiresAt < Date.now() || e.version !== globalVersion) {
    store.delete(key);
    return undefined;
  }
  return e.data;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs, version: globalVersion });
}

export function cacheInvalidateAll(): void {
  globalVersion += 1;
  store.clear();
}

export const CACHE_TTL = {
  EMPLOYEES: 60_000,
  ADMIN_CONFIG: 30_000
} as const;
