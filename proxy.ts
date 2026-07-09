// Next.js 16 replaces `middleware.ts` with `proxy.ts`. Same API surface, new
// file convention. The matcher excludes API routes, Next internals, and
// static files so the proxy stays cheap.

import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Next.js 16 requires a function named `proxy` (or a default export).
// We re-export Auth.js's `auth` wrapper as the proxy entrypoint.
export const proxy = auth;
export default proxy;

export const config = {
  // Run on every page route, skip API routes, Next internals, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map)$).*)"],
};
