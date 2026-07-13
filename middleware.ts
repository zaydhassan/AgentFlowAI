// =============================================================================
// Rate limiting middleware (Edge runtime)
// =============================================================================
// Applies per-IP rate limiting to every /api/* request. The route path selects
// the policy (auth/ai/workflow/memory/mcp/public); webhooks + OAuth callbacks
// are exempt (external-driven). Blocked requests get HTTP 429 + Retry-After +
// X-RateLimit-Limit/Remaining/Reset; allowed requests pass through.
//
// Next.js middleware is Edge-only, so this uses the in-memory limiter (see
// lib/rate-limit/edge.ts for the Edge/Redis rationale). The Redis-backed limiter
// in lib/rate-limit (Node) is the configured default for Node contexts.
//
// Set RATE_LIMIT_ENABLED=false to disable entirely.

import { NextResponse, type NextRequest } from "next/server";
import { runRateLimit } from "@/lib/rate-limit/edge";

// Only API routes are limited; everything else is untouched.
export const config = {
  matcher: "/api/:path*",
};

export async function middleware(req: NextRequest) {
  const blocked = await runRateLimit(req);
  return blocked ?? NextResponse.next();
}