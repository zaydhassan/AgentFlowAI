// Multi-Agent Runtime — per-run trace + control.
// GET  /api/agents/run/[runId]  → live trace snapshot (timeline, latency,
//                                 tokens, reasoning path, graph, events).
// POST /api/agents/run/[runId]  → control a live run:
//                                   { action: "approve" | "reject" | "stop", feedback? }
//
// The trace is served from the in-memory run handle, so it is available while a
// run is in flight or paused at an approval checkpoint. After completion the
// handle is unregistered (single-process dev server) and GET returns 404 — the
// final trace was already delivered in the SSE `complete` event.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { getAgentRun, stopAgentRun } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ runId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { runId } = await params;

  const handle = getAgentRun(runId);
  if (!handle) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  // Workspace isolation: only the run's owner may read its trace.
  if (handle.ctxSeed.userId !== u.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ trace: handle.tracer.snapshot(), status: handle.status });
}

export async function POST(req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { runId } = await params;

  const handle = getAgentRun(runId);
  if (!handle) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (handle.ctxSeed.userId !== u.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: { action?: string; feedback?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  switch (body.action) {
    case "stop":
      return NextResponse.json({ ok: stopAgentRun(runId) });
    case "approve":
    case "reject":
      // Mark the decision; the client resumes the SSE stream via
      // POST /api/agents/run?control=resume&runId=<id> with the same decision.
      return NextResponse.json({
        ok: true,
        resume: { approved: body.action === "approve", feedback: body.feedback },
        resumeUrl: `/api/agents/run?control=resume&runId=${encodeURIComponent(runId)}`,
      });
    default:
      return NextResponse.json({ error: "Unknown action. Use approve | reject | stop." }, { status: 400 });
  }
}