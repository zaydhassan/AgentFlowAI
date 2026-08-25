import "server-only";
import { prisma } from "@/lib/db";
import type {
  ExecutionDetail,
  ExecutionRow,
  ExecutionStepRow,
  ExecutionsList,
} from "./types";

// `failed` rolls up `cancelled` runs too — same convention as the observability
// summary's FINISHED set. `running` is its own bucket (still in flight).
const FAILED_STATUSES = ["failed", "cancelled"];

export async function listExecutions(
  userId: string,
  opts: { status?: string | null; q?: string | null } = {},
): Promise<ExecutionsList> {
  const status = opts.status?.trim() || null;
  const q = opts.q?.trim() || null;

  const where = {
    ownerId: userId,
    ...(status ? { status } : {}),
    ...(q ? { workflow: { name: { contains: q, mode: "insensitive" as const } } } : {}),
  };

  // Recent rows + status counts run in parallel.
  const [rows, statusGroups] = await Promise.all([
    prisma.execution.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 200,
      include: {
        workflow: { select: { name: true } },
        _count: { select: { steps: true } },
      },
    }),
    prisma.execution.groupBy({
      by: ["status"],
      where: { ownerId: userId },
      _count: { _all: true },
    }),
  ]);

  const runs: ExecutionRow[] = rows.map((e) => ({
    id: e.id,
    workflowId: e.workflowId,
    workflowName: e.workflow.name,
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
  }));

  const counts = { running: 0, succeeded: 0, failed: 0, total: 0 };
  for (const g of statusGroups) {
    counts.total += g._count._all;
    if (g.status === "running") counts.running += g._count._all;
    else if (g.status === "succeeded") counts.succeeded += g._count._all;
    else if (FAILED_STATUSES.includes(g.status)) counts.failed += g._count._all;
  }

  return { runs, counts };
}

export async function getExecution(
  userId: string,
  executionId: string,
): Promise<ExecutionDetail | null> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      workflow: { select: { id: true, name: true } },
      steps: { orderBy: { startedAt: "asc" } },
    },
  });
  // Owner scoping: 404 (not null) if the run doesn't exist or isn't owned by the
  // caller — no cross-user leak.
  if (!execution || execution.ownerId !== userId) return null;

  const steps: ExecutionStepRow[] = execution.steps.map((s) => ({
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
    memories:
      (s.memories as { score: number; id: string; content: string; scope?: string }[] | null) ?? null,
    error: s.error,
  }));

  return {
    id: execution.id,
    workflowId: execution.workflow.id,
    workflowName: execution.workflow.name,
    status: execution.status,
    trigger: execution.trigger,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() ?? null,
    durationMs: execution.durationMs,
    totalTokens: execution.totalTokens,
    totalCost: execution.totalCost,
    retried: execution.retried,
    error: execution.error,
    stepCount: steps.length,
    steps,
  };
}