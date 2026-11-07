/**
 * Minimal per-key TTL cache with in-flight de-duplication: concurrent callers
 * share one load, failed loads are not cached.
 */
export function createTtlCache<K, V>(loader: (key: K) => Promise<V>, ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<K, { value: V; expiresAt: number }>();
  const inFlight = new Map<K, Promise<V>>();
  let generation = 0;

  return {
    async get(key: K): Promise<V> {
      const entry = entries.get(key);
      if (entry && entry.expiresAt > now()) return entry.value;

      const pending = inFlight.get(key);
      if (pending) return pending;

      const startedAt = generation;
      const load = loader(key)
        .then(value => {
          // A load started before invalidate() must not repopulate the cache with stale data.
          if (startedAt === generation) entries.set(key, { value, expiresAt: now() + ttlMs });
          return value;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, load);
      return load;
    },

    invalidate(): void {
      generation++;
      entries.clear();
      inFlight.clear();
    },
  };
}
