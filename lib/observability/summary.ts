import "server-only";
import { prisma } from "@/lib/db";
import { observabilitySummary } from "@/lib/mcp";
import type {
  AiNodeSlice,
  AuditLogRow,
  DailyTrendPoint,
  InFlightRun,
  ObservabilityKpis,
  ObservabilitySummary,
  PromptVersionRow,
  RecentExecutionRow,
} from "./types";

const DAY = 86_400_000;
const FINISHED = ["succeeded", "failed", "cancelled"] as const;

// Fixed palette for known AI node types, plus a rotated fallback for anything
// new. Keeps the donut stable across renders.
const AI_NODE_COLORS: Record<string, string> = {
  "ai.claude": "#d97706",
  "ai.openai": "#10a37f",
  "ai.gemini": "#4285f4",
  "ai.router": "#7c5cff",
  "ai.agent": "#22d3ee",
  "ai.memory": "#fbbf24",
  "ai.prompt": "#34d399",
  "ai.multiAgent": "#a855f7",
};
const FALLBACK_COLORS = ["#64748b", "#0ea5e9", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6"];

// Nearest-rank percentile over an ascending-sorted array.
function percentile(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const idx = Math.max(0, Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

export async function getObservabilitySummary(userId: string): Promise<ObservabilitySummary> {
  const since30 = new Date(Date.now() - 30 * DAY);
  const since14 = new Date(Date.now() - 14 * DAY);

  const [
    durationRows,
    statusGroups,
    runningNow,
    activeWorkflows,
    trendRows,
    aiNodeGroups,
    inFlightRows,
    recentRows,
    versionRows,
    auditRows,
    mcp,
  ] = await Promise.all([
    // 1. Percentiles (capped 1000 finished).
    prisma.execution.findMany({
      where: { ownerId: userId, status: { in: [...FINISHED] }, durationMs: { gt: 0 } },
      orderBy: { startedAt: "desc" },
      take: 1000,
      select: { durationMs: true },
    }),
    // 2. 30d status counts + sums.
    prisma.execution.groupBy({
      by: ["status"],
      where: { ownerId: userId, startedAt: { gte: since30 } },
      _count: { _all: true },
      _sum: { totalCost: true, totalTokens: true, retried: true },
    }),
    // 3. Running now (no startedAt filter — runs can be old).
    prisma.execution.count({ where: { ownerId: userId, status: "running" } }),
    // 4. Active workflows.
    prisma.workflow.count({ where: { ownerId: userId, status: "active" } }),
    // 5. 14d trend rows (capped 10k).
    prisma.execution.findMany({
      where: { ownerId: userId, startedAt: { gte: since14 } },
      select: { status: true, startedAt: true, totalCost: true, totalTokens: true },
      orderBy: { startedAt: "asc" },
      take: 10_000,
    }),
    // 6. AI node distribution (30d).
    prisma.executionStep.groupBy({
      by: ["nodeType"],
      where: {
        execution: { ownerId: userId, startedAt: { gte: since30 } },
        nodeType: { startsWith: "ai." },
      },
      _count: { _all: true },
      _sum: { tokensUsed: true },
    }),
    // 7. In-flight runs (SSE targets).
    prisma.execution.findMany({
      where: { ownerId: userId, status: "running" },
      include: { workflow: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    // 8. Recent executions.
    prisma.execution.findMany({
      where: { ownerId: userId },
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { workflow: { select: { name: true } }, _count: { select: { steps: true } } },
    }),
    // 9. Prompt versions.
    prisma.workflowVersion.findMany({
      where: { workflow: { ownerId: userId } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { workflow: { select: { name: true } } },
    }),
    // 10. Audit logs.
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: { select: { name: true } } },
    }),
    // 12. Optional MCP fold-in (never breaks the rest on throw).
    observabilitySummary(userId).catch(() => undefined),
  ]);

  const durations = durationRows.map((r) => r.durationMs).sort((a, b) => a - b);
  const buckets = new Map<string, { count: number; cost: number; tokens: number; retried: number }>();
  for (const g of statusGroups) {
    buckets.set(g.status, {
      count: g._count._all,
      cost: g._sum.totalCost ?? 0,
      tokens: g._sum.totalTokens ?? 0,
      retried: g._sum.retried ?? 0,
    });
  }
  const finishedCount = FINISHED.reduce((s, st) => s + (buckets.get(st)?.count ?? 0), 0);
  const succeededCount = buckets.get("succeeded")?.count ?? 0;
  const sumCost = FINISHED.reduce((s, st) => s + (buckets.get(st)?.cost ?? 0), 0);
  const sumTokens = FINISHED.reduce((s, st) => s + (buckets.get(st)?.tokens ?? 0), 0);
  const sumRetried = FINISHED.reduce((s, st) => s + (buckets.get(st)?.retried ?? 0), 0);

  const kpis: ObservabilityKpis = {
    p50LatencyMs: percentile(durations, 50),
    p99LatencyMs: percentile(durations, 99),
    cost30d: round2(sumCost),
    tokens30d: sumTokens,
    successRate: finishedCount ? round1((succeededCount / finishedCount) * 100) : null,
    avgRetries: finishedCount ? Math.round((sumRetried / finishedCount) * 100) / 100 : null,
    runningNow,
    activeWorkflows,
    executions30d: finishedCount,
  };

  const dayKey = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const trend: DailyTrendPoint[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * DAY);
    return { date: dayKey(d), executions: 0, success: 0, failures: 0, cost: 0, tokens: 0 };
  });
  const trendByKey = new Map(trend.map((t) => [t.date, t]));
  for (const e of trendRows) {
    const point = trendByKey.get(dayKey(e.startedAt));
    if (!point) continue; // straddles the boundary (≥14d ago) — ignore.
    point.executions++;
    if (e.status === "succeeded") point.success++;
    else if (e.status === "failed" || e.status === "cancelled") point.failures++;
    point.cost = round2(point.cost + e.totalCost);
    point.tokens += e.totalTokens;
  }

  let fallbackIdx = 0;
  const aiNodeDistribution: AiNodeSlice[] = aiNodeGroups
    .map((g) => {
      const nodeType = g.nodeType ?? "?";
      const color = AI_NODE_COLORS[nodeType] ?? FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
      return {
        name: nodeType.replace(/^ai\./, ""),
        nodeType,
        value: g._count._all,
        tokens: g._sum.tokensUsed ?? 0,
        color,
      };
    })
    .sort((a, b) => b.value - a.value);

  const inFlight: InFlightRun[] = inFlightRows.map((e) => ({
    executionId: e.id,
    workflowId: e.workflowId,
    workflowName: e.workflow.name,
    startedAt: e.startedAt.toISOString(),
    trigger: e.trigger,
  }));

  const recent: RecentExecutionRow[] = recentRows.map((e) => ({
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

  const promptVersions: PromptVersionRow[] = versionRows.map((v) => ({
    id: v.id,
    workflowId: v.workflowId,
    workflowName: v.workflow.name,
    version: v.version,
    message: v.message,
    createdBy: v.createdBy,
    createdAt: v.createdAt.toISOString(),
  }));

  const auditLogs: AuditLogRow[] = auditRows.map((a) => {
    const md = (a.metadata ?? null) as Record<string, unknown> | null;
    const target =
      typeof md?.target === "string" ? md.target : typeof md?.entityType === "string" ? md.entityType : null;
    return {
      id: a.id,
      actor: a.user?.name ?? null,
      action: a.action,
      target,
      createdAt: a.createdAt.toISOString(),
    };
  });

  return {
    hasData: recent.length > 0,
    kpis,
    trend,
    aiNodeDistribution,
    inFlight,
    recent,
    promptVersions,
    auditLogs,
    ...(mcp ? { mcp } : {}),
  };
}