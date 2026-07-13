// =============================================================================
// Rate Limiting — Edge runtime entry (for middleware.ts)
// =============================================================================
// Next.js 16 middleware is Edge-only (EdgeRuntime): ioredis is Node-only and
// CANNOT be imported or executed there. So the Edge enforcement path uses the
// IN-MEMORY limiter — which is exactly the documented "fall back to in-memory
// when Redis is unavailable" behavior, applied here because Redis is unavailable
// in this runtime.
//
// To keep ioredis OUT of the Edge bundle, this module imports ONLY the pure
// types, the policies, and the in-memory limiter. It must NEVER import
// ./index (the Node facade, which statically imports ./redis) — that would drag
// the dynamic `import("ioredis")` into the Edge build and break it.
//
// The Redis-backed limiter (lib/rate-limit/redis via lib/rate-limit/index) is the
// configured default provider and is used the moment rate limiting runs in a
// Node context (applyRateLimit in a route handler). The two facades share the
// same types, policies, headers, and observability core (./policies, ./types,
// ./in-memory).

import { NextResponse, type NextRequest } from "next/server";
import { InMemoryRateLimiter } from "./in-memory";
import {
  POLICIES,
  buildKey,
  incAllowed,
  incBlocked,
  policyForPath,
  rateLimitHeaders,
} from "./policies";
import type { LimitPolicy, RateLimitResult } from "./types";

let _limiter: InMemoryRateLimiter | null = null;
function limiter(): InMemoryRateLimiter {
  if (!_limiter) _limiter = new InMemoryRateLimiter();
  return _limiter;
}

function enabled(): boolean {
  return (process.env.RATE_LIMIT_ENABLED ?? "true").toLowerCase() !== "false";
}

/**
 * Best-effort client IP. Honors the standard proxy headers; "unknown" when none
 * are present (still limited — every "unknown" shares one bucket).
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

/**
 * Run the rate-limit check for an Edge request. Returns a 429 NextResponse when
 * blocked (with Retry-After + X-RateLimit-* headers) or null when allowed — the
 * middleware caller then proceeds with NextResponse.next(). Fails open on any
 * limiter error: a rate-limit fault must never break a request.
 */
export async function runRateLimit(req: NextRequest): Promise<NextResponse | null> {
  if (!enabled()) return null;
  const path = req.nextUrl.pathname;
  const policy: LimitPolicy | null = policyForPath(path);
  if (!policy) return null; // not an API route, or exempt (webhook/callback)

  const ip = getClientIp(req);
  const key = buildKey(policy, "ip", ip);
  let result: RateLimitResult;
  try {
    result = await limiter().check({ key, policy });
  } catch {
    return null; // fail open
  }

  if (result.allowed) {
    incAllowed();
    return null;
  }
  incBlocked();
  return new NextResponse(
    JSON.stringify({ error: "Rate limit exceeded", retryAfter: result.retryAfter }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", ...rateLimitHeaders(result) },
    },
  );
}

// Re-export POLICIES for any Edge caller that wants the named limits directly.
export { POLICIES };