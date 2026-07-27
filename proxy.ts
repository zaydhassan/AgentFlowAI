// Next.js 16 replaces `middleware.ts` with `proxy.ts`. Same API surface, new
// file convention. Only one proxy file is allowed, so this single proxy
// combines two concerns that previously lived in separate files:
//   1. Per-IP rate limiting on /api/* requests (Edge in-memory limiter).
//   2. NextAuth `auth` wrapper on page routes (runs the `authorized` callback
//      in auth.config.ts for auth gating / session injection).
// We branch on the path: API routes get rate-limited only (auth is handled
// per-route by the NextAuth route handlers); page routes get auth-gated only.

import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { runRateLimit } from "@/lib/rate-limit/edge";

const { auth } = NextAuth(authConfig);

// `auth` is typed as a higher-order wrapper, but at runtime it is also a valid
// middleware callable as `(req) => Response | undefined`. Expose that call
// signature explicitly so we can invoke it directly for page routes.
const authProxy = auth as unknown as (
  req: NextRequest,
) => Response | undefined | Promise<Response | undefined>;

// Next.js 16 requires a function named `proxy` (or a default export).
export const proxy = async (req: NextRequest) => {
  const { pathname } = req.nextUrl;

  // API routes: rate-limit only. Auth is handled per-route by NextAuth route
  // handlers, so we don't run the `authorized` gate here.
  if (pathname.startsWith("/api/")) {
    const blocked = await runRateLimit(req);
    return blocked ?? NextResponse.next();
  }

  // Page routes: defer to the NextAuth `auth` wrapper, which runs the
  // `authorized` callback in auth.config.ts. An undefined return lets the
  // request pass through unchanged.
  return (await authProxy(req)) ?? NextResponse.next();
};
export default proxy;

export const config = {
  // Run on every page route AND every /api/* route, but skip Next internals
  // and static files so the proxy stays cheap. (API routes branch to the
  // rate limiter above; page routes branch to NextAuth.)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map)$).*)",
    "/api/:path*",
  ],
};