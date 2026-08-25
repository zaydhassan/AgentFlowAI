import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { listWorkspaceResources } from "@/lib/mcp";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const items = await cached(`mcp:resources:${u.user.id}`, 60, () => listWorkspaceResources(u.user.id));
  return NextResponse.json({ items });
}