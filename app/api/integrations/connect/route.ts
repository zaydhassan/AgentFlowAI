import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiUser } from "@/lib/auth/api";
import { getOAuthStart, OAUTH_STATE_COOKIE } from "@/lib/integrations";
import type { IntegrationProviderId } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { provider: IntegrationProviderId; returnUrl?: string; accountId?: string };

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.provider) {
    return NextResponse.json({ error: "Missing provider" }, { status: 400 });
  }

  const session = await auth();
  const orgId = session?.user?.orgId ?? null;

  try {
    const { authUrl, stateValue } = await getOAuthStart({
      providerId: body.provider,
      userId: user.id,
      orgId,
      returnUrl: body.returnUrl,
      accountId: body.accountId,
      requestUrl: req.url,
    });
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
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start connect." }, { status: 503 });
  }
}