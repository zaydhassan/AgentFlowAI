// GET /api/mcp/tools — all allow-filtered tools across the workspace's servers.
// Drives the inspector `mcp.tool` dropdown and the planner's ctx.tools.list().
//
// "Cache MCP tool discovery": the response is edge-cached here (per-user, 60s
// TTL). lib/mcp (the MCP runtime) is NOT modified — the cache sits at the HTTP
// boundary. Discovery is a relatively expensive workspace aggregation, so a
// short TTL slashes repeated dropdown loads / planner lookups without staleness
// concerns (discovery is refreshable on demand via POST /api/mcp/servers/[id]/discover).

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { listWorkspaceTools } from "@/lib/mcp";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const items = await cached(`mcp:tools:${u.user.id}`, 60, () => listWorkspaceTools(u.user.id));
  return NextResponse.json({ items });
}