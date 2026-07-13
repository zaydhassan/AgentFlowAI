// =============================================================================
// Rate Limiting — Redis limiter (Node-only, lazy ioredis, atomic Lua)
// =============================================================================
// The production shared limiter. Reuses the app's REDIS_URL on its own
// connection (rate limiting is high-frequency and wants fast failure, so it
// keeps its own pool tuned with maxRetriesPerRequest: 1).
//
// Atomicity: every algorithm runs as a single Lua EVALSHA (SCRIPT LOAD'd once on
// connect) so concurrent requests can't overrun the limit. On any Redis error
// (NOSCRIPT, connection lost, EVAL failure) the check transparently delegates
// to an internal InMemoryRateLimiter — the documented graceful fallback.
//
// Node-only. NEVER imported by the Edge entry (lib/rate-limit/edge) — ioredis
// can't run in the Edge runtime, and importing this module there would drag it
// into the Edge bundle. The Node facade (lib/rate-limit/index) is the only
// consumer. ioredis is loaded LAZILY (dynamic import inside connect()), so
// merely importing this module costs nothing until a check runs.

import type { RateLimitInput, RateLimitResult, RateLimiter } from "./types";
import { InMemoryRateLimiter } from "./in-memory";

// Lua scripts. Each returns [allowed(1/0), remaining, resetAtMs, retryAfterMs].
// KEYS[1] = the rate-limit key; ARGVs carry now / window / limit / ids.

const SLIDING = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetAt = tonumber(oldest[2] or now) + window
  return {0, 0, resetAt, resetAt - now}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window + 1000)
local first = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local resetAt = tonumber(first[2] or now) + window
return {1, limit - count - 1, resetAt, 0}
`;

const FIXED = `
local key = KEYS[1]
local bucket = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local count = redis.call('INCR', key)
if count == 1 then redis.call('PEXPIRE', key, window) end
if count > limit then
  local resetAt = bucket + window
  return {0, 0, resetAt, resetAt - now}
end
return {1, limit - count, bucket + window, 0}
`;

const TOKEN = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local rate = tonumber(ARGV[3])
local data = redis.call('HMGET', key, 'tokens', 'last')
local tokens = tonumber(data[1])
local last = tonumber(data[2])
if tokens == nil then tokens = capacity end
if last == nil then last = now end
local elapsed = now - last
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + elapsed * rate)
last = now
local allowed = 0
local remaining = 0
local retryAfter = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
  remaining = math.floor(tokens)
else
  retryAfter = math.ceil((1 - tokens) / rate)
end
redis.call('HMSET', key, 'tokens', tokens, 'last', last)
local ttl = math.ceil(capacity / rate) * 1000
if ttl < 1000 then ttl = 1000 end
redis.call('PEXPIRE', key, ttl)
local resetAt
if allowed == 1 then
  resetAt = now + math.ceil((capacity - tokens) / rate) * 1000
else
  resetAt = now + retryAfter * 1000
end
return {allowed, remaining, resetAt, retryAfter * 1000}
`;

export class RedisRateLimiter implements RateLimiter {
  readonly id = "redis";
  readonly active = true;

  // ioredis is untyped here to avoid a static type import that would pull its
  // types into this module's surface; runtime is fully dynamic-imported.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private ready = false;
  private connecting: Promise<boolean> | null = null;
  private readonly fallback = new InMemoryRateLimiter();
  private shas: Record<string, string> = {};

  constructor(
    private readonly url: string,
    private readonly connectTimeoutMs = 3000,
  ) {}

  /** Ensure a healthy connection. Returns false (once) if Redis is unavailable. */
  private ensure(): Promise<boolean> {
    if (this.ready && this.client) return Promise.resolve(true);
    if (this.connecting) return this.connecting;
    this.connecting = this.connect();
    return this.connecting;
  }

  private async connect(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import("ioredis");
      const RedisCtor = mod.default ?? mod;
      const redis = new RedisCtor(this.url, {
        maxRetriesPerRequest: 1, // fail fast — the fallback covers us
        enableReadyCheck: true,
        connectTimeout: this.connectTimeoutMs,
        retryStrategy: (times: number) => Math.min(times * 200, 1000),
      });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => {
            redis.disconnect();
            reject(new Error("rate-limit redis connect timeout"));
          },
          this.connectTimeoutMs,
        );
        const onReady = () => { clearTimeout(timer); redis.off("error", onError); resolve(); };
        const onError = (err: Error) => { clearTimeout(timer); redis.disconnect(); reject(err); };
        redis.once("ready", onReady);
        redis.once("error", onError);
      });
      // Pre-load the Lua scripts so hot-path checks use EVALSHA, not EVAL.
      const [s, f, t] = await Promise.all([
        redis.script("LOAD", SLIDING),
        redis.script("LOAD", FIXED),
        redis.script("LOAD", TOKEN),
      ]);
      this.shas = { sliding: s, fixed: f, token: t };
      this.client = redis;
      this.ready = true;
      this.connecting = null;
      return true;
    } catch {
      this.ready = false;
      this.client = null;
      this.connecting = null;
      return false;
    }
  }

  async check(input: RateLimitInput): Promise<RateLimitResult> {
    const { key, policy } = input;
    if (!(await this.ensure())) return this.fallback.check(input); // Redis down → memory
    const now = Date.now();
    const windowMs = policy.window * 1000;
    try {
      let res: number[];
      if (policy.algorithm === "fixed") {
        const bucket = Math.floor(now / windowMs) * windowMs;
        res = await this.client.evalsha(
          this.shas.fixed, 1, `${key}:${bucket}`, bucket, windowMs, policy.limit, now,
        );
      } else if (policy.algorithm === "token") {
        const rate = policy.limit / policy.window;
        res = await this.client.evalsha(
          this.shas.token, 1, key, now, policy.limit, rate,
        );
      } else {
        // sliding (default) — a unique member keeps ZADD distinct under concurrency.
        const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
        res = await this.client.evalsha(
          this.shas.sliding, 1, key, now, windowMs, policy.limit, member,
        );
      }
      const parts = (res ?? []).map((n: unknown) => Number(n));
      const [allowed = 1, remaining = 0, resetAt = now, retryAfterMs = 0] = parts;
      return {
        allowed: allowed === 1,
        limit: policy.limit,
        remaining,
        resetAt,
        retryAfter: Math.max(0, Math.ceil(retryAfterMs / 1000)),
        algorithm: policy.algorithm,
      };
    } catch {
      // NOSCRIPT (script evicted), transient error, or connection drop — fall
      // back to the in-memory limiter for THIS check so a Redis hiccup never
      // 500s a request. The next check retries Redis via ensure().
      return this.fallback.check(input);
    }
  }

  async close(): Promise<void> {
    this.ready = false;
    try { await this.client?.quit(); } catch { /* best-effort */ }
    this.client = null;
    this.shas = {};
    await this.fallback.close();
  }
}