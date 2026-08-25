import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { observability } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const summary = await observability(u.user.id);
  return NextResponse.json(summary);
}