// GET /api/executions/[id] — one execution + its persisted steps, including the
// full AI Workflow Debugger inspection payload (nodeType/config/input/output/
// prompt/memories) per step. Owner-scoped by Execution.ownerId (404, not null,
// when the run is missing or belongs to another user — no cross-user leak). The
// client opens a native EventSource to the per-workflow stream route separately
// to animate an in-flight run; this endpoint is the persisted snapshot.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { getExecution } from "@/lib/executions/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;

  const { id } = await params;
  const detail = await getExecution(u.user.id, id);
  if (!detail) return NextResponse.json({ error: "Execution not found." }, { status: 404 });

  return NextResponse.json(detail);
}