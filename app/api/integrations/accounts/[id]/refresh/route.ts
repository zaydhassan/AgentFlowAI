import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { refreshAccount } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  try {
    const { status } = await refreshAccount(user.id, id);
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection test failed.";
    const invalidGrant = /invalid_grant|revoked|expired/i.test(msg);
    return NextResponse.json(
      { ok: false, error: invalidGrant ? "Gmail access was revoked — reconnect the account." : msg },
      { status: invalidGrant ? 410 : 500 },
    );
  }
}