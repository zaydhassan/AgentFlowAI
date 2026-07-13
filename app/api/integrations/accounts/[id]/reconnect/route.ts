// POST /api/integrations/accounts/[id]/reconnect — re-initiate OAuth for an
// existing (e.g. revoked) account. Returns { authUrl } + sets a fresh state
// cookie (same as /connect, but bound to the existing account id).

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { reconnectStart, OAUTH_STATE_COOKIE } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  try {
    const { authUrl, stateValue } = await reconnectStart(user.id, id, req.url);
    const res = NextResponse.json({ authUrl });
    res.cookies.set(OAUTH_STATE_COOKIE, stateValue, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start reconnect.";
    const status = /not found/i.test(msg) ? 404 : 503;
    return NextResponse.json({ error: msg }, { status });
  }
}