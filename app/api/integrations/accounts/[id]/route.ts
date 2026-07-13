// DELETE /api/integrations/accounts/[id] — disconnect: revoke at the provider
// (best-effort) + delete the local row. Owner-only.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { disconnectAccount } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  try {
    await disconnectAccount(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not disconnect.";
    const status = /not found/i.test(msg) ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}