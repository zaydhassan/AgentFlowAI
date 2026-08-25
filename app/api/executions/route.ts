import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { listExecutions } from "@/lib/executions/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  return NextResponse.json(await listExecutions(u.user.id, { status, q }));
}