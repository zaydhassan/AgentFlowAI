// Run history for a workflow.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  const wf = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true } });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const executions = await prisma.execution.findMany({
    where: { workflowId: id },
    orderBy: { startedAt: "desc" },
    take: 100,
    include: { _count: { select: { steps: true } } },
  });

  return NextResponse.json({
    executions: executions.map((e) => ({
      id: e.id,
      status: e.status,
      trigger: e.trigger,
      startedAt: e.startedAt.toISOString(),
      finishedAt: e.finishedAt?.toISOString() ?? null,
      durationMs: e.durationMs,
      totalTokens: e.totalTokens,
      totalCost: e.totalCost,
      retried: e.retried,
      error: e.error,
      stepCount: e._count.steps,
    })),
  });
}