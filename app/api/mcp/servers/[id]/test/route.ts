// POST /api/mcp/servers/[id]/test — (re)connect + ping; records health + status.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { testServer } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing server id." }, { status: 400 });
  const health = await testServer(u.user.id, id);
  return NextResponse.json(health);
}