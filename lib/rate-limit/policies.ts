// =============================================================================
// Rate Limiting — named policies, route→policy map, headers, observability
// =============================================================================
// Pure JS + process.env reads — NO Node-only APIs, NO ioredis. Safe to import
// from both the Node facade (lib/rate-limit/index) AND the Edge middleware
// entry (lib/rate-limit/edge). This is the shared, runtime-agnostic core the
// two facades build on.

import type { Algorithm, LimitPolicy, RateLimitSnapshot } from "./types";

/** Parse a positive number env var with a fallback. */
function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// RATE_LIMIT_DEFAULT_* configure the catch-all "public" policy (the global
// default). Specific policies (auth/ai/workflow/memory/mcp) carry the spec'd
// limits below, each independently overridable via RATE_LIMIT_<NAME>_LIMIT /
// RATE_LIMIT_<NAME>_WINDOW. Sliding window is the default algorithm everywhere.
const defaultLimit = (): number => numEnv("RATE_LIMIT_DEFAULT_LIMIT", 100);
const defaultWindow = (): number => numEnv("RATE_LIMIT_DEFAULT_WINDOW", 60);

function policy(
  name: string,
  specLimit: number,
  specWindow: number,
  algorithm: Algorithm = "sliding",
): LimitPolicy {
  return {
    name,
    limit: numEnv(`RATE_LIMIT_${name.toUpperCase()}_LIMIT`, specLimit),
    window: numEnv(`RATE_LIMIT_${name.toUpperCase()}_WINDOW`, specWindow),
    algorithm,
  };
}

/**
 * The six named limits. Per-policy env overrides (e.g. RATE_LIMIT_AI_LIMIT) win
 * over the spec'd defaults; RATE_LIMIT_DEFAULT_LIMIT / _WINDOW govern `public`.
 */
export const POLICIES: Record<string, LimitPolicy> = {
  auth: policy("auth", 5, 60),
  ai: policy("ai", 30, 60),
  workflow: policy("workflow", 20, 60),
  memory: policy("memory", 60, 60),
  mcp: policy("mcp", 60, 60),
  public: policy("public", defaultLimit(), defaultWindow()),
};

/** Look up a policy by name. */
export function getPolicy(name: string): LimitPolicy | undefined {
  return POLICIES[name];
}

/**
 * Route path → policy. Returns null when the path is not an API route or is
 * exempt (incoming webhooks + OAuth callbacks are driven by external callers,
 * not user traffic, so they bypass limiting to avoid false positives).
 */
export function policyForPath(path: string): LimitPolicy | null {
  if (!path.startsWith("/api/")) return null;
  // Exempt: provider webhooks + integration OAuth callbacks.
  if (path.includes("/webhook") || path.includes("/callback")) return null;
  // Auth.js client-polled endpoints (session/csrf/providers) are fetched on
  // every mount, navigation, and window-focus by useSession. Throttling them
  // at the brute-force "auth" budget (5/60s) trips almost instantly and makes
  // the client receive a 429 instead of a csrfToken/session → ClientFetchError.
  // They are non-sensitive (session is the caller's own; csrf is a CSRF
  // token), so exempt them. The "auth" budget still applies to user-initiated
  // actions (signin/signout) below.
  if (
    path === "/api/auth/session" ||
    path === "/api/auth/csrf" ||
    path === "/api/auth/providers"
  ) {
    return null;
  }
  if (path.startsWith("/api/auth/")) return POLICIES.auth;
  if (path === "/api/ai" || path.startsWith("/api/ai/")) return POLICIES.ai;
  if (path.startsWith("/api/workflows/")) {
    // Execution endpoints carry the workflow limit; reads fall to public.
    if (path.endsWith("/run") || path.includes("/executions")) return POLICIES.workflow;
    return POLICIES.public;
  }
  if (path === "/api/memory/search") return POLICIES.memory;
  if (path.startsWith("/api/mcp/invoke")) return POLICIES.mcp;
  return POLICIES.public;
}

/**
 * Compose the limiter key: `rl:{policy}:{scope}:{id}`. `scope` is the
 * identification dimension ("ip" | "user" | "key" | "workspace") and `id` is the
 * raw identifier value. The middleware uses ip; Node route guards pick whichever
 * dimension they have (user id, api key, workspace id).
 */
export function buildKey(p: LimitPolicy, scope: string, id: string): string {
  return `rl:${p.name}:${scope}:${id}`;
}

/**
 * The standard rate-limit response headers. `resetAt` is epoch ms; the header is
 * seconds. `retryAfter` is already seconds (clamped to ≥1). Used on 429s (and
 * optionally surfaced on 200s for client visibility).
 */
export function rateLimitHeaders(r: {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}): Record<string, string> {
  return {
    "Retry-After": String(Math.max(1, Math.ceil(r.retryAfter))),
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(Math.max(0, Math.floor(r.remaining))),
    "X-RateLimit-Reset": String(Math.floor(r.resetAt / 1000)),
  };
}

// ─────────────────────────── observability ─────────────────────────────────
// Module-level counters. In a Node process these are shared across requests
// (the authoritative aggregate). In the Edge runtime each isolate keeps its
// own counters — the snapshot is per-isolate; the per-request X-RateLimit-*
// headers always carry the authoritative current-usage + window-reset values.
const _stats = { allowed: 0, blocked: 0, errors: 0 };

export function incAllowed(): void { _stats.allowed++; }
export function incBlocked(): void { _stats.blocked++; }
export function incError(): void { _stats.errors++; }

export function rateLimitStats(): RateLimitSnapshot {
  const total = _stats.allowed + _stats.blocked;
  return {
    allowed: _stats.allowed,
    blocked: _stats.blocked,
    errors: _stats.errors,
    blockedRate: total ? _stats.blocked / total : 0,
  };
}

/** Reset the counters — exposed for tests / env hot-reload, not runtime use. */
export function resetRateLimitStats(): void {
  _stats.allowed = _stats.blocked = _stats.errors = 0;
}