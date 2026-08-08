// GET /api/executions — the global, owner-scoped executions list that powers
// /executions. Returns recent runs (capped 200) plus a status-breakdown counts
// object (running / succeeded / failed / total). Optional `status` and `q`
// (workflow-name contains, case-insensitive) query params filter the run list;
// counts always reflect the owner's full set. `force-dynamic` keeps it uncached;
// `nodejs` runtime is required for Prisma + the server-only module.

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