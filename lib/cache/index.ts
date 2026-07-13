// =============================================================================
// Cache — production-ready, provider-agnostic caching layer
// =============================================================================
// Resolution order for `getCache()`:
//   1. CACHE_ENABLED=false            → NoopCacheProvider (every read is a miss)
//   2. CACHE_ENABLED=true, no REDIS_URL → InMemoryCacheProvider (per-process LRU+TTL)
//   3. CACHE_ENABLED=true, REDIS_URL   → RedisCacheProvider wrapped in a
//      ResilientCacheProvider that transparently falls back to InMemoryCacheProvider
//      when Redis is unreachable, and reopens the circuit after a cooldown.
//
// All integration code calls `cached()` / `cacheDel()` / `cacheInvalidate()`
// (below) — never a provider method directly — so hit/miss metrics are counted
// exactly once per operation regardless of which provider is active.
//
// Redis is reached via a LAZY `import("ioredis")`, so the app boots even if the
// package is absent (the noop/memory path never touches it). The dependency is
// declared in package.json so the Redis path resolves once installed.
//
// Server-only.

import "server-only";
import type { CacheProvider, CacheSnapshot, CacheStats } from "./types";
export type { CacheProvider, CacheGetOptions, CacheStats, CacheSnapshot } from "./types";

// ─────────────────────────── metrics ─────────────────────────────────────────
// Single module-level counter set shared by every provider. Counted at the
// `cached()` / `cacheDel()` / `cacheInvalidate()` choke points (one increment
// per logical operation) so wrapping a primary with a fallback never double-counts.
const stats = { hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0 };

export function cacheStats(): CacheStats {
  const total = stats.hits + stats.misses;
  return { ...stats, hitRate: total ? stats.hits / total : 0 };
}

export function resetCacheStats(): void {
  stats.hits = stats.misses = stats.sets = stats.deletes = stats.errors = 0;
}

// ─────────────────────────── NoopCacheProvider ──────────────────────────────
// Active when caching is disabled. Every read is a miss; writes are dropped.
// Lets `cached()` short-circuit to the loader with zero overhead.
class NoopCacheProvider implements CacheProvider {
  readonly id = "noop";
  readonly active = false;
  // `cached()` checks `active` and bypasses us, so these are never reached in
  // practice — but implement the contract for direct callers. The return type
  // is a bare `Promise<undefined>` (no generic): `undefined` is assignable to
  // `T | undefined` for every T, so this still satisfies `CacheProvider.get<T>`.
  async get(): Promise<undefined> { return undefined; }
  async set(): Promise<void> {}
  async del(): Promise<void> {}
  async delByPrefix(): Promise<void> {}
  async ping(): Promise<boolean> { return false; }
  async close(): Promise<void> {}
}

// ─────────────────────────── InMemoryCacheProvider ──────────────────────────
// Per-process LRU-ish map with per-entry TTL. Used standalone (no REDIS_URL)
// and as the ResilientCacheProvider's fallback when Redis is down.
class InMemoryCacheProvider implements CacheProvider {
  readonly id = "memory";
  readonly active = true;
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly maxEntries = 2000;

  constructor() {
    // Sweep expired entries every 60s. `unref` so the timer never keeps the
    // process alive in serverless/edge runtimes.
    const t = setInterval(() => this.sweep(), 60_000);
    t.unref?.();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt < Date.now()) { this.store.delete(key); return undefined; }
    // Refresh insertion order so frequently-read keys survive the LRU evict.
    this.store.delete(key);
    this.store.set(key, e);
    return e.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxEntries) this.evict();
    this.store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
  }

  async del(key: string): Promise<void> { this.store.delete(key); }

  async delByPrefix(prefix: string): Promise<void> {
    if (!prefix) return;
    for (const k of [...this.store.keys()]) if (k.startsWith(prefix)) this.store.delete(k);
  }

  async ping(): Promise<boolean> { return true; }
  async close(): Promise<void> { this.store.clear(); }

  private sweep(): void {
    const now = Date.now();
    for (const [k, e] of this.store) if (e.expiresAt < now) this.store.delete(k);
  }

  private evict(): void {
    // Drop the oldest 25% (Map preserves insertion order) — cheap & bounded.
    let n = Math.floor(this.maxEntries / 4);
    for (const k of this.store.keys()) {
      this.store.delete(k);
      if (--n <= 0) break;
    }
  }
}

// ─────────────────────────── RedisCacheProvider ─────────────────────────────
// Wraps a lazily-created `ioredis` client. Connection is established on first
// use with a bounded timeout; methods THROW when the client is unusable so the
// enclosing ResilientCacheProvider can fall back to in-memory. JSON is the wire
// format (values are plain JSON-serializable objects across this codebase).
//
// `delByPrefix` uses SCAN (never KEYS) to stay safe on large keyspaces.
class RedisCacheProvider implements CacheProvider {
  readonly id = "redis";
  readonly active = true;
  // The ioredis instance is created lazily (see ensure()/connect). It's typed
  // loosely on purpose: the client is constructed from a dynamic import, and
  // its methods are only ever called after a successful connect.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private ready = false;
  private connecting: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly connectTimeoutMs = 3000,
  ) {}

  private async ensure(): Promise<void> {
    if (this.ready && this.client) return;
    if (!this.connecting) this.connecting = this.connect();
    await this.connecting; // throws on failure → handled by ResilientCacheProvider
  }

  private async connect(): Promise<void> {
    // Lazy import: the noop/memory path never loads ioredis. `any` keeps tsc
    // happy even before the package is installed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("ioredis");
    const Redis = mod.default ?? mod;
    const redis = new Redis(this.url, {
      connectTimeout: this.connectTimeoutMs,
      maxRetriesPerRequest: 1, // fail a queued command after 1 retry, don't hang
      enableOfflineQueue: false, // reject commands while disconnected (we catch)
      retryStrategy: (times: number) => Math.min(times * 200, 1000),
    });
    // Resolve once the client reports ready, or reject on first error/timeout.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("redis connect timeout")),
        this.connectTimeoutMs,
      );
      const onReady = () => { clearTimeout(timer); redis.off("error", onError); resolve(); };
      const onError = (err: Error) => { clearTimeout(timer); redis.disconnect(); reject(err); };
      redis.once("ready", onReady);
      redis.once("error", onError);
    });
    this.client = redis;
    this.ready = true;
    this.connecting = null;
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.ensure();
    const raw: string | null = await this.client.get(key);
    if (raw == null) return undefined;
    try { return JSON.parse(raw) as T; } catch { return undefined; } // corrupt → miss
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.ensure();
    await this.client.set(key, JSON.stringify(value), "EX", Math.max(1, Math.floor(ttlSeconds)));
  }

  async del(key: string): Promise<void> {
    await this.ensure();
    await this.client.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (!prefix) return;
    await this.ensure();
    let cursor = "0";
    do {
      const [next, keys]: [string, string[]] = await this.client.scan(
        cursor, "MATCH", `${prefix}*`, "COUNT", 200,
      );
      if (keys.length) await this.client.del(...keys);
      cursor = next;
    } while (cursor !== "0");
  }

  async ping(): Promise<boolean> {
    try { await this.ensure(); return (await this.client.ping()) === "PONG"; }
    catch { return false; }
  }

  async close(): Promise<void> {
    this.ready = false;
    try { await this.client?.quit(); } catch { /* best-effort */ }
  }
}

// ─────────────────────────── ResilientCacheProvider ─────────────────────────
// Wraps a primary (Redis) + a fallback (in-memory) with a small circuit breaker:
// after `failureThreshold` consecutive primary failures the circuit opens for
// `cooldownMs`, routing all traffic to the fallback; the first call after the
// cooldown closes the circuit and retries the primary. This is the
// "gracefully fall back when Redis is unavailable" guarantee — once Redis
// recovers, traffic resumes on it automatically.
class ResilientCacheProvider implements CacheProvider {
  readonly id: string;
  readonly active = true;
  private readonly primary: CacheProvider;
  private readonly fallback: CacheProvider;
  private readonly failureThreshold = 3;
  private readonly cooldownMs = 30_000;
  private failures = 0;
  private openUntil = 0;

  constructor(primary: CacheProvider, fallback: CacheProvider) {
    this.primary = primary;
    this.fallback = fallback;
    this.id = `${primary.id}+${fallback.id}`;
  }

  private route(): CacheProvider {
    if (this.openUntil && Date.now() < this.openUntil) return this.fallback;
    if (this.openUntil) { this.openUntil = 0; this.failures = 0; } // cooldown elapsed → retry primary
    return this.primary;
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.openUntil = Date.now() + this.cooldownMs;
  }

  private onSuccess(): void {
    this.failures = 0;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const p = this.route();
    if (p === this.fallback) return this.fallback.get<T>(key);
    try { const v = await this.primary.get<T>(key); this.onSuccess(); return v; }
    catch { this.onFailure(); return this.fallback.get<T>(key); }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const p = this.route();
    if (p === this.fallback) return this.fallback.set(key, value, ttlSeconds);
    try { await this.primary.set(key, value, ttlSeconds); this.onSuccess(); }
    catch { this.onFailure(); await this.fallback.set(key, value, ttlSeconds); }
  }

  async del(key: string): Promise<void> {
    try { await this.primary.del(key); this.onSuccess(); }
    catch { this.onFailure(); await this.fallback.del(key); }
  }

  async delByPrefix(prefix: string): Promise<void> {
    try { await this.primary.delByPrefix(prefix); this.onSuccess(); }
    catch { this.onFailure(); await this.fallback.delByPrefix(prefix); }
  }

  async ping(): Promise<boolean> {
    try { const ok = await this.primary.ping(); if (ok) { this.onSuccess(); return true; } }
    catch { /* fall through */ }
    this.onFailure();
    return this.fallback.ping();
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.primary.close(), this.fallback.close()]);
  }
}

// ─────────────────────────── factory ────────────────────────────────────────
let _provider: CacheProvider | null = null;

function resolveProvider(): CacheProvider {
  const enabled = (process.env.CACHE_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) return new NoopCacheProvider();
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return new InMemoryCacheProvider();
  const timeoutMs = Math.max(500, Number(process.env.CACHE_CONNECT_TIMEOUT_MS ?? 3000));
  return new ResilientCacheProvider(
    new RedisCacheProvider(redisUrl, timeoutMs),
    new InMemoryCacheProvider(),
  );
}

/** Return the process-wide cache provider (memoized on first call). */
export function getCache(): CacheProvider {
  if (!_provider) _provider = resolveProvider();
  return _provider;
}

/** Reset the singleton — exposed for tests and env hot-reload, not for runtime use. */
export function __resetCacheForTests(): void {
  void _provider?.close();
  _provider = null;
}

// ─────────────────────────── helpers ────────────────────────────────────────
/** Default TTL (seconds) for entries that don't specify one. */
export function defaultTtl(): number {
  return Math.max(1, Number(process.env.CACHE_DEFAULT_TTL ?? 60));
}

/**
 * Get-or-set: read `key`; on a miss run `loader`, cache its result for
 * `ttlSeconds`, and return it. Counted as a hit on a cache read and a miss on a
 * cache miss. Never throws on cache errors — the loader is the source of truth.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (ttlSeconds <= 0) return loader();
  const cache = getCache();
  if (!cache.active) { stats.misses++; return loader(); }
  try {
    const hit = await cache.get<T>(key);
    if (hit !== undefined) { stats.hits++; return hit; }
  } catch {
    stats.errors++;
  }
  stats.misses++;
  const value = await loader();
  try { await cache.set(key, value, ttlSeconds); stats.sets++; } catch { stats.errors++; }
  return value;
}

/** Delete one key. Counted as a delete. Never throws on cache errors. */
export async function cacheDel(key: string): Promise<void> {
  try { await getCache().del(key); stats.deletes++; } catch { stats.errors++; }
}

/** Delete every key beginning with `prefix`. Counted as a delete. Never throws. */
export async function cacheInvalidate(prefix: string): Promise<void> {
  if (!prefix) return;
  try { await getCache().delByPrefix(prefix); stats.deletes++; } catch { stats.errors++; }
}

/** Point-in-time provider + counters, for a /metrics or /health endpoint. */
export function cacheSnapshot(): CacheSnapshot {
  const cache = getCache();
  return { provider: cache.id, active: cache.active, stats: cacheStats() };
}