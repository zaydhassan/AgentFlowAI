// POST /api/mcp/servers/[id]/discover — (re)connect and refresh the cached
// tools/resources/prompts/capabilities from the live server.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { discoverServer } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing server id." }, { status: 400 });
  try {
    const result = await discoverServer(u.user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Discovery failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}