// Shared auth helper for route handlers. Wraps getCurrentUser so each route
// gets a clean 401 for no-session and a 500 (with the cause logged) for DB
// errors — instead of every route re-implementing the try/catch.
//
// Usage:
//   const u = await apiUser();
//   if ("error" in u) return u.error;
//   const { user } = u;

import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./session";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export type ApiUserResult = { user: SessionUser } | { error: NextResponse };

export async function apiUser(): Promise<ApiUserResult> {
  let user: SessionUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    console.error("[api] session lookup failed", err);
    return {
      error: NextResponse.json(
        { error: "Could not verify your session. Please try again." },
        { status: 500 },
      ),
    };
  }
  if (!user) {
    return {
      error: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }),
    };
  }
  return { user };
}