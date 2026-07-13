// =============================================================================
// Cache — provider-agnostic contract
// =============================================================================
// Any key/value store (Redis, Memcached, Valkey, Upstash, an in-process Map)
// implements `CacheProvider` and plugs in via `getCache()` in ./index. The rest
// of the app depends only on this interface + the `cached()` helper, never on a
// concrete provider — so swapping Redis for another store is a one-file change.
//
// Pure types only (no server-only import) so client-safe modules may reference
// the interface without pulling server-side code into the browser bundle.

/** Optional flags for a cache read (reserved for future bypass/no-stale controls). */
export interface CacheGetOptions {
  /** Skip the cache and force a fresh load. */
  bypass?: boolean;
}

/** A cache provider. Implementations MUST be safe to call concurrently. */
export interface CacheProvider {
  /** Stable provider id surfaced in metrics snapshots ("redis" | "memory" | "noop" | "redis+memory"). */
  readonly id: string;
  /** True when the provider actually caches values. False for the no-op provider. */
  readonly active: boolean;

  /** Read a value. Returns `undefined` on a miss (or when the provider is unavailable). */
  get<T>(key: string): Promise<T | undefined>;
  /** Write a value with a TTL in seconds. No-op when the provider is unavailable. */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  /** Delete one key. */
  del(key: string): Promise<void>;
  /** Delete every key beginning with `prefix` (used for tag/group invalidation). */
  delByPrefix(prefix: string): Promise<void>;
  /** Health probe. Returns true when the backing store is reachable. */
  ping(): Promise<boolean>;
  /** Release any held connections. Idempotent. */
  close(): Promise<void>;
}

/** Cumulative cache counters (provider-agnostic). */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  /** hits / (hits + misses); 0 when there are no get operations yet. */
  hitRate: number;
}

/** A point-in-time view of the active provider + its counters. */
export interface CacheSnapshot {
  provider: string;
  active: boolean;
  stats: CacheStats;
}