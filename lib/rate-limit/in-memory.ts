import type { LimitPolicy, RateLimitInput, RateLimitResult, RateLimiter } from "./types";

const ok = (p: LimitPolicy, remaining: number, resetAt: number): RateLimitResult => ({
  allowed: true,
  limit: p.limit,
  remaining,
  resetAt,
  retryAfter: 0,
  algorithm: p.algorithm,
});

const blocked = (p: LimitPolicy, resetAt: number, now: number): RateLimitResult => ({
  allowed: false,
  limit: p.limit,
  remaining: 0,
  resetAt,
  retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  algorithm: p.algorithm,
});

export class InMemoryRateLimiter implements RateLimiter {
  readonly id = "memory";
  readonly active = true;

  private readonly sw = new Map<string, number[]>();
  private readonly fw = new Map<string, { count: number; resetAt: number }>();
  private readonly tb = new Map<string, { tokens: number; last: number }>();
  private lastSweep = 0;

  async check(input: RateLimitInput): Promise<RateLimitResult> {
    const { key, policy } = input;
    const now = Date.now();
    const windowMs = policy.window * 1000;
    switch (policy.algorithm) {
      case "fixed":
        return this.fixed(key, policy, now, windowMs);
      case "token":
        return this.token(key, policy, now);
      case "sliding":
      default:
        return this.sliding(key, policy, now, windowMs);
    }
  }

  // Sliding window (log): keep the timestamps of the last `limit` allowed
  // requests; drop everything older than `window`. If the surviving set is full,
  // block until the oldest one expires. Exact (not an approximation).
  private sliding(key: string, p: LimitPolicy, now: number, windowMs: number): RateLimitResult {
    const arr = this.sw.get(key) ?? [];
    const cutoff = now - windowMs;
    // Prune expired (timestamps are pushed in order, so we can stop early).
    let i = 0;
    while (i < arr.length && arr[i] <= cutoff) i++;
    const cur = i > 0 ? arr.slice(i) : arr;
    if (cur.length >= p.limit) {
      const resetAt = cur[0] + windowMs;
      this.sw.set(key, cur);
      return blocked(p, resetAt, now);
    }
    cur.push(now);
    this.sw.set(key, cur);
    return ok(p, p.limit - cur.length, cur[0] + windowMs);
  }

  // Fixed window: a counter per (key, window bucket). Resets wholesale at each
  // bucket boundary. Cheaper than sliding; coarser at the boundary.
  private fixed(key: string, p: LimitPolicy, now: number, windowMs: number): RateLimitResult {
    const bucketStart = Math.floor(now / windowMs) * windowMs;
    const bucketKey = `${key}:${bucketStart}`;
    let st = this.fw.get(bucketKey);
    if (!st) {
      st = { count: 0, resetAt: bucketStart + windowMs };
      this.fw.set(bucketKey, st);
    }
    // Opportunistic sweep so the map can't grow unbounded across buckets.
    if (this.fw.size > 5000 && now - this.lastSweep > 1000) {
      this.lastSweep = now;
      for (const [k, v] of this.fw) if (v.resetAt <= now) this.fw.delete(k);
    }
    st.count++;
    if (st.count > p.limit) return blocked(p, st.resetAt, now);
    return ok(p, Math.max(0, p.limit - st.count), st.resetAt);
  }

  // Token bucket: capacity = limit, refill at limit/window tokens per second.
  // Allows short bursts up to capacity while bounding the sustained rate.
  private token(key: string, p: LimitPolicy, now: number): RateLimitResult {
    const rate = p.limit / p.window; // tokens / second
    let st = this.tb.get(key);
    if (!st) {
      st = { tokens: p.limit, last: now };
      this.tb.set(key, st);
    }
    const elapsed = Math.max(0, (now - st.last) / 1000);
    st.tokens = Math.min(p.limit, st.tokens + elapsed * rate);
    st.last = now;
    if (st.tokens >= 1) {
      st.tokens -= 1;
      const remaining = Math.floor(st.tokens);
      const resetAt = now + Math.ceil((p.limit - st.tokens) / rate) * 1000;
      return ok(p, remaining, resetAt);
    }
    const retryAfterSec = Math.max(1, Math.ceil((1 - st.tokens) / rate));
    const resetAt = now + retryAfterSec * 1000;
    return {
      allowed: false,
      limit: p.limit,
      remaining: 0,
      resetAt,
      retryAfter: retryAfterSec,
      algorithm: p.algorithm,
    };
  }

  async close(): Promise<void> {
    this.sw.clear();
    this.fw.clear();
    this.tb.clear();
  }
}