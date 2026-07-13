// =============================================================================
// Rate Limiting — provider-agnostic contract
// =============================================================================
// Any backend (Redis via lib/rate-limit/redis, the in-memory limiter, a future
// Upstash/edge adapter) implements `RateLimiter` and plugs in via getRateLimiter()
// (Node) or the in-memory factory (Edge middleware). Pure types — runtime-
// agnostic, safe to import from both Node and Edge bundles.

/** Rate-limiting algorithm. Sliding window is the default. */
export type Algorithm = "sliding" | "fixed" | "token";

/** A named, configurable limit. `window` is in seconds. */
export interface LimitPolicy {
  name: string;
  limit: number;
  window: number;
  algorithm: Algorithm;
}

/** Input to a limiter check: the fully-qualified key + the policy. */
export interface RateLimitInput {
  key: string;
  policy: LimitPolicy;
}

/** A limiter decision. Times are epoch milliseconds; retryAfter is seconds. */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms — when the window resets / next token available
  retryAfter: number; // seconds to wait before retrying (0 when allowed)
  algorithm: Algorithm;
}

/** The provider-agnostic limiter contract. */
export interface RateLimiter {
  /** Stable provider id surfaced in metrics ("redis" | "memory" | "noop"). */
  readonly id: string;
  /** True when the limiter actually tracks state (false for the disabled no-op). */
  readonly active: boolean;
  /** Check (and consume) one unit against the policy. Atomic on Redis. */
  check(input: RateLimitInput): Promise<RateLimitResult>;
  /** Release any held connections. Idempotent. */
  close(): Promise<void>;
}

/** Aggregate observability counters. */
export interface RateLimitSnapshot {
  allowed: number;
  blocked: number;
  errors: number;
  /** blocked / (allowed + blocked); 0 when empty. */
  blockedRate: number;
}