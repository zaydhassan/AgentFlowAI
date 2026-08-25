import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";
import { runSingleNode } from "@/lib/execution/replay";
import { sseStream } from "@/lib/execution/sse";
import { resolveOrgId } from "@/lib/memory";
import type { EngineGraph, RunControls } from "@/lib/execution/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; eid: string; nodeId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id, eid, nodeId } = await params;

  const wf = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true, graph: true } });
  if (!wf || wf.ownerId !== user.id) return new Response(JSON.stringify({ error: "Not found." }), { status: 404, headers: { "Content-Type": "application/json" } });

  const execution = await prisma.execution.findUnique({
    where: { id: eid },
    select: { workflowId: true, steps: { where: { nodeId }, orderBy: { startedAt: "desc" }, take: 1 } },
  });
  if (!execution || execution.workflowId !== id) return new Response(JSON.stringify({ error: "Execution not found." }), { status: 404, headers: { "Content-Type": "application/json" } });

  const step = execution.steps[0];
  if (!step) return new Response(JSON.stringify({ error: "Node not found in this execution." }), { status: 404, headers: { "Content-Type": "application/json" } });

  // Resolve the node definition from the workflow's current graph. Replay uses
  // the live node config (the common debugging case: fix the config, then
  // replay to see the new result). Layout/position are irrelevant here.
  const graph = normalizeGraph(wf.graph) as EngineGraph;
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return new Response(JSON.stringify({ error: "Node no longer exists in the workflow." }), { status: 404, headers: { "Content-Type": "application/json" } });

  // Recorded upstream inputs (from the persisted step). Old rows without
  // `input` fall back to an empty feed.
  const inputs = Array.isArray(step.input) ? (step.input as unknown[]) : [];

  const orgId = await resolveOrgId(user.id);
  let aborted = false;

  const controls: RunControls = {
    breakpoints: new Set(),
    awaitResume: () => Promise.resolve("resume"),
    stopped: () => aborted,
    userId: user.id,
    workflowId: id,
    orgId,
  };

  const gen = runSingleNode(node, inputs, controls);

  return sseStream(gen, {
    onDone: () => { aborted = true; },
  });
}