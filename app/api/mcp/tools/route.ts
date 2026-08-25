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