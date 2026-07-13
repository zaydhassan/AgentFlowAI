// =============================================================================
// Rate Limiting — Node facade (provider-agnostic factory + route guard)
// =============================================================================
// Resolution order for getRateLimiter():
//   1. RATE_LIMIT_ENABLED=false                  → NoopRateLimiter (always allow)
//   2. RATE_LIMIT_PROVIDER=memory                → InMemoryRateLimiter
//   3. RATE_LIMIT_PROVIDER=redis (default), no REDIS_URL → InMemoryRateLimiter
//   4. RATE_LIMIT_PROVIDER=redis, REDIS_URL set   → RedisRateLimiter, which
//      itself falls back to an in-memory limiter per check when Redis is down
//      (graceful fallback at both the factory and the runtime levels).
//
// `applyRateLimit()` is the seam for Node route handlers: returns null (allow)
// or a 429 Response with the standard headers. Every existing API route belongs
// to a protected system (workflows / ai / memory / mcp / auth / payments /
// integrations / queue), so wiring this guard into any of them would violate
// "do not modify unrelated systems" — instead the cross-cutting enforcement
// lives in middleware.ts (Edge, in-memory; see lib/rate-limit/edge.ts), and the
// Redis-backed guard here is ready for any Node consumer.
//
// Server-only (Node).

import "server-only";
import type {
  LimitPolicy,
  RateLimitInput,
  RateLimitResult,
  RateLimiter,
} from "./types";
import { InMemoryRateLimiter } from "./in-memory";
import { RedisRateLimiter } from "./redis";
import {
  buildKey,
  incAllowed,
  incBlocked,
  incError,
  rateLimitHeaders,
  resetRateLimitStats,
} from "./policies";

export * from "./types";
export {
  POLICIES,
  getPolicy,
  policyForPath,
  buildKey,
  rateLimitHeaders,
  rateLimitStats,
  resetRateLimitStats,
  incAllowed,
  incBlocked,
  incError,
} from "./policies";
export { InMemoryRateLimiter } from "./in-memory";
export { RedisRateLimiter } from "./redis";

// ─────────────────────────── no-op (disabled) ────────────────────────────────
class NoopRateLimiter implements RateLimiter {
  readonly id = "noop";
  readonly active = false;
  async check(input: RateLimitInput): Promise<RateLimitResult> {
    const now = Date.now();
    return {
      allowed: true,
      limit: input.policy.limit,
      remaining: input.policy.limit,
      resetAt: now + input.policy.window * 1000,
      retryAfter: 0,
      algorithm: input.policy.algorithm,
    };
  }
  async close(): Promise<void> {}
}

// ─────────────────────────── factory ─────────────────────────────────────────
let _limiter: RateLimiter | null = null;
let _noop: RateLimiter | null = null;

function rateLimitEnabled(): boolean {
  return (process.env.RATE_LIMIT_ENABLED ?? "true").toLowerCase() !== "false";
}

function provider(): "redis" | "memory" {
  return (process.env.RATE_LIMIT_PROVIDER ?? "redis").toLowerCase() === "memory"
    ? "memory"
    : "redis";
}

/** Return the active limiter (memoized). Honors RATE_LIMIT_* env switches. */
export function getRateLimiter(): RateLimiter {
  if (!rateLimitEnabled()) {
    if (!_noop) _noop = new NoopRateLimiter();
    return _noop;
  }
  if (_limiter) return _limiter;
  if (provider() === "memory") {
    _limiter = new InMemoryRateLimiter();
    return _limiter;
  }
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    _limiter = new InMemoryRateLimiter();
    return _limiter;
  }
  const timeoutMs = Number(process.env.RATE_LIMIT_CONNECT_TIMEOUT_MS ?? 3000);
  _limiter = new RedisRateLimiter(url, timeoutMs);
  return _limiter;
}

/**
 * Check (and consume) one unit for a policy + identifier. Records observability
 * and FAILS OPEN (allow) on any limiter error — rate limiting must never take
 * the app down with it. `scope` is the identification dimension ("ip" | "user"
 * | "key" | "workspace"); `id` is the raw identifier value.
 */
export async function check(
  policy: LimitPolicy,
  scope: string,
  id: string,
): Promise<RateLimitResult> {
  const key = buildKey(policy, scope, id);
  try {
    const r = await getRateLimiter().check({ key, policy });
    if (r.allowed) incAllowed();
    else incBlocked();
    return r;
  } catch {
    incError();
    const now = Date.now();
    return {
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit,
      resetAt: now + policy.window * 1000,
      retryAfter: 0,
      algorithm: policy.algorithm,
    };
  }
}

/**
 * Node route-guard. Returns null when the request is allowed, or a 429 Response
 * carrying Retry-After + X-RateLimit-* when blocked. Drop into any Node route
 * handler: `const blocked = await applyRateLimit(POLICIES.ai, "user", userId);
 * if (blocked) return blocked;`. The current live enforcement is the Edge
 * middleware (in-memory); this is the Redis-backed equivalent for Node contexts.
 */
export async function applyRateLimit(
  policy: LimitPolicy,
  scope: string,
  id: string,
): Promise<Response | null> {
  const r = await check(policy, scope, id);
  if (r.allowed) return null;
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded", retryAfter: r.retryAfter }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", ...rateLimitHeaders(r) },
    },
  );
}

/** Release the limiter's connection (e.g. on graceful shutdown). */
export async function closeRateLimiter(): Promise<void> {
  await _limiter?.close();
  _limiter = null;
}

/** Reset the singleton + counters — exposed for tests / env hot-reload. */
export async function __resetRateLimitForTests(): Promise<void> {
  await _limiter?.close();
  _limiter = null;
  resetRateLimitStats();
}