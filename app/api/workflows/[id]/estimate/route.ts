// Preflight AI cost/latency estimate for a workflow (before execution).
// GET ?strategy=cost|fast|balanced — returns per-provider estimates + the
// cheapest/fastest/balanced recommendation. Owner-checked, reuses normalizeGraph
// and the execution engine's token/duration estimators (see lib/ai/optimizer).
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";
import { estimateWorkflow, type Strategy, type EstimateResponse } from "@/lib/ai/optimizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const STRATEGIES: Strategy[] = ["cost", "fast", "balanced"];

export async function GET(req: Request, { params }: Params): Promise<NextResponse<EstimateResponse | { error: string }>> {
  const u = await apiUser();
  if ("error" in u) return u.error as NextResponse<{ error: string }>;
  const { user } = u;
  const { id } = await params;

  const url = new URL(req.url);
  const s = url.searchParams.get("strategy");
  const strategy: Strategy = STRATEGIES.includes(s as Strategy) ? (s as Strategy) : "balanced";

  const wf = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true, graph: true } });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const graph = normalizeGraph(wf.graph);
  const estimate = estimateWorkflow(graph, strategy);
  return NextResponse.json(estimate);
}