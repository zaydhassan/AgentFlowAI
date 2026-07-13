// GET /api/mcp/invocations?serverId=&status=&workflowId=&limit= — audit trail.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { listInvocations } from "@/lib/mcp";
import type { McpInvocationStatus } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const url = new URL(req.url);
  const serverId = url.searchParams.get("serverId") ?? undefined;
  const status = (url.searchParams.get("status") as McpInvocationStatus | null) ?? undefined;
  const workflowId = url.searchParams.get("workflowId") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const invocations = await listInvocations(u.user.id, {
    ...(serverId ? { serverId } : {}),
    ...(status ? { status } : {}),
    ...(workflowId ? { workflowId } : {}),
    ...(limit && Number.isFinite(limit) ? { limit } : {}),
  });
  return NextResponse.json({ invocations });
}