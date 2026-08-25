import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; eid: string }> };

export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id, eid } = await params;

  const wf = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true } });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const execution = await prisma.execution.findUnique({
    where: { id: eid },
    include: { steps: { orderBy: { startedAt: "asc" } } },
  });
  if (!execution || execution.workflowId !== id) {
    return NextResponse.json({ error: "Execution not found." }, { status: 404 });
  }

  return NextResponse.json({
    execution: {
      id: execution.id,
      status: execution.status,
      trigger: execution.trigger,
      startedAt: execution.startedAt.toISOString(),
      finishedAt: execution.finishedAt?.toISOString() ?? null,
      durationMs: execution.durationMs,
      totalTokens: execution.totalTokens,
      totalCost: execution.totalCost,
      retried: execution.retried,
      error: execution.error,
      steps: execution.steps.map((s) => ({
        id: s.id,
        nodeId: s.nodeId,
        nodeName: s.nodeName,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        durationMs: s.durationMs,
        tokensUsed: s.tokensUsed,
        cost: s.cost,
        retries: s.retries,
        logs: s.logs as string[],
        reasoning: (s.reasoning as string[] | null) ?? null,
        // Debugger inspection payload (nullable on older rows).
        nodeType: s.nodeType,
        config: s.config,
        input: s.input,
        output: s.output,
        prompt: s.prompt as { system: string; user: string } | null,
        memories: s.memories as { score: number; id: string; content: string; scope?: string }[] | null,
        error: s.error,
      })),
    },
  });
}