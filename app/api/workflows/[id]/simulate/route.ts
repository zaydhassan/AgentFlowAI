import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";
import { simulateWorkflow, type SimulationResult } from "@/lib/execution/simulate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse<SimulationResult | { error: string }>> {
  const u = await apiUser();
  if ("error" in u) return u.error as NextResponse<{ error: string }>;
  const { user } = u;
  const { id } = await params;

  const wf = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true, graph: true } });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: { graph?: unknown } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  // Prefer the client's current canvas (un-saved edits), else the stored graph.
  const graph = normalizeGraph(body.graph ?? wf.graph);
  const result = simulateWorkflow(graph);
  return NextResponse.json(result);
}