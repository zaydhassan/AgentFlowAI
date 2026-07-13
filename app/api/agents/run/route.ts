// Multi-Agent Runtime — run endpoint.
// POST   /api/agents/run            → start a run, SSE stream of AgentEvents.
// POST   /api/agents/run?control=resume&runId=<id>  → resume an approval checkpoint (SSE).
// POST   /api/agents/run?control=stop&runId=<id>    → cancel a live run (JSON).
//
// Auth: apiUser(). Workspace isolation: the run is scoped to the authenticated
// user (memory gateway filters by ownerId) and their primary org (resolveOrgId).
//
// The SSE stream frames each AgentEvent as `data: <json>\n\n` and emits a
// terminal `event: done`. When requireApproval is set, the stream ends with an
// `approval-requested` event; resume by POSTing here with ?control=resume.

import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { resolveOrgId } from "@/lib/memory";
import { sseStream } from "@/lib/execution/sse";
import { startAgentRun, resumeAgentRun, stopAgentRun } from "@/lib/agents";
import type { AgentEvent, AgentRunOptions } from "@/lib/agents";
import type { MemoryScope } from "@/lib/memory/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SCOPES: MemoryScope[] = [
  "short_term", "conversation", "long_term", "workflow", "agent", "workspace",
];

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const url = new URL(req.url);
  const control = url.searchParams.get("control");
  const runId = url.searchParams.get("runId");

  // ── control: stop ──
  if (control === "stop" && runId) {
    return NextResponse.json({ ok: stopAgentRun(runId) });
  }

  // ── control: resume an approval checkpoint ──
  if (control === "resume" && runId) {
    let body: { approved?: boolean; feedback?: string } = {};
    try {
      body = (await req.json()) ?? {};
    } catch {
      body = {};
    }
    const approved = body.approved === true;
    const feedback = typeof body.feedback === "string" ? body.feedback : undefined;
    const gen = resumeAgentRun(runId, { approved, feedback });
    return sseStream(gen as AsyncGenerator<AgentEvent, unknown, unknown>);
  }

  // ── start a run ──
  let body: StartBody = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  if (!body.objective || !String(body.objective).trim()) {
    return NextResponse.json({ error: "objective is required." }, { status: 400 });
  }

  const orgId = await resolveOrgId(user.id);
  const id = body.runId ?? cryptoRandomId();
  const memoryScope = SCOPES.includes(body.memoryScope as MemoryScope)
    ? (body.memoryScope as MemoryScope)
    : "long_term";

  const opts: AgentRunOptions = {
    runId: id,
    objective: String(body.objective).trim(),
    input: body.input,
    userId: user.id,
    orgId,
    workflowId: body.workflowId ?? null,
    nodeId: body.nodeId ?? null,
    memoryScope,
    maxIterations: clampInt(body.maxIterations, 1, 6, 2),
    timeoutMs: clampInt(body.timeoutMs, 10_000, 300_000, 120_000),
    requireApproval: body.requireApproval === true,
    guidance: typeof body.guidance === "string" ? body.guidance : undefined,
  };

  const gen = startAgentRun(opts);
  return sseStream(gen as AsyncGenerator<AgentEvent, unknown, unknown>);
}

interface StartBody {
  runId?: string;
  objective?: string;
  input?: unknown;
  workflowId?: string;
  nodeId?: string;
  memoryScope?: string;
  maxIterations?: number;
  timeoutMs?: number;
  requireApproval?: boolean;
  guidance?: string;
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function cryptoRandomId(): string {
  try {
    return `ar_${crypto.randomUUID()}`;
  } catch {
    return `ar_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}