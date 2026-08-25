import "server-only";
import { prisma } from "@/lib/db";
import { repository } from "@/lib/notifications/repository";
import { enqueueDigest } from "@/lib/notifications/queue";
import { getPreferences, digestOptedIn } from "@/lib/notifications/preferences";
import { PLAN_CREDIT_LIMIT } from "@/lib/payments/plans";
import type { PlanId } from "@/lib/payments/types";
import type {
  DigestChartPoint,
  DigestData,
  DigestFrequency,
  DigestStat,
  NotificationSeverity,
} from "@/lib/notifications/types";

export interface Period {
  start: Date;
  end: Date;
  /** Label for the digest header ("Yesterday" / "Last 7 days" / the hour). */
  label: string;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** Compute the digest period for a frequency, anchored to "now". */
export function computePeriod(frequency: "hourly" | "daily" | "weekly", now: Date = new Date()): Period {
  if (frequency === "hourly") {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0));
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    return { start, end, label: `${start.toUTCString().slice(17, 22)} UTC` };
  }
  if (frequency === "weekly") {
    const todayStart = startOfDay(now);
    const start = new Date(todayStart.getTime() - 7 * 86_400_000);
    return { start, end: todayStart, label: "Last 7 days" };
  }
  const todayStart = startOfDay(now);
  const start = new Date(todayStart.getTime() - 86_400_000);
  return { start, end: todayStart, label: "Yesterday" };
}

/**
 * Run a Prisma count and return 0 if it throws (e.g. the underlying table does
 * not exist in this database). Used for optional tables the digest references
 * but that may not be migrated yet (McpInvocation), so a missing optional
 * subsystem never breaks digest generation.
 */
async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return 0;
  }
}

/**
 * Build the charts-ready DigestData payload for a user + period, from real DB
 * events. Powers both the email and the NotificationDigest row's `summary`.
 */
export async function buildDigestData(
  userId: string,
  frequency: "hourly" | "daily" | "weekly",
  period: Period,
): Promise<DigestData> {
  const { start, end } = period;

  const [
    succeeded,
    failed,
    sums,
    agentRuns,
    integrations,
    sub,
    notificationsCount,
    chartRows,
    topWfGroups,
  ] = await Promise.all([
    prisma.execution.count({ where: { ownerId: userId, startedAt: { gte: start, lt: end }, status: "succeeded" } }),
    prisma.execution.count({ where: { ownerId: userId, startedAt: { gte: start, lt: end }, status: "failed" } }),
    prisma.execution.aggregate({
      where: { ownerId: userId, startedAt: { gte: start, lt: end } },
      _sum: { totalTokens: true, totalCost: true },
    }),
    // AI agent runs in the window (multi-agent runtime rows live in McpInvocation
    // with agentId set; count distinct runs). Falls back to 0 when the table is
    // absent (the MCP subsystem's migration may not be applied yet in some envs).
    safeCount(() => prisma.mcpInvocation.count({
      where: { ownerId: userId, createdAt: { gte: start, lt: end }, agentId: { not: null } },
    })),
    prisma.integrationAccount.count({ where: { ownerId: userId, status: "active" } }),
    prisma.subscription.findUnique({ where: { userId }, select: { plan: true } }),
    repository.countDigestEligible(userId, start, end),
    frequency === "weekly"
      ? prisma.execution.findMany({
          where: { ownerId: userId, startedAt: { gte: start, lt: end } },
          select: { status: true, startedAt: true, totalTokens: true, totalCost: true },
          orderBy: { startedAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.execution.groupBy({
      by: ["workflowId"],
      where: { ownerId: userId, startedAt: { gte: start, lt: end } },
      _count: { _all: true },
      orderBy: { _count: { workflowId: "desc" } },
      take: 5,
    }),
  ]);

  const settled = succeeded + failed;
  const successRate = settled > 0 ? Math.round((succeeded / settled) * 1000) / 10 : 0;
  const tokens = sums._sum.totalTokens ?? 0;
  const cost = Math.round((sums._sum.totalCost ?? 0) * 100) / 100;
  const plan = (sub?.plan as PlanId) ?? "free";
  const creditLimit = PLAN_CREDIT_LIMIT[plan] ?? PLAN_CREDIT_LIMIT.free;
  const usage = await prisma.usage.findFirst({
    where: { userId, periodStart: { lte: end } },
    orderBy: { periodStart: "desc" },
    select: { aiCredits: true },
  });
  const creditsRemaining = Math.max(0, creditLimit - (usage?.aiCredits ?? 0));

  const stats: DigestStat[] = [
    { label: "Workflows completed", value: succeeded.toLocaleString() },
    { label: "Success rate", value: `${successRate}%` },
    { label: "AI agents run", value: agentRuns.toLocaleString() },
    { label: "Tokens", value: formatTokens(tokens) },
    { label: "Cost", value: `$${cost.toFixed(2)}` },
    { label: "Integrations", value: integrations.toString() },
    { label: "Credits left", value: creditsRemaining.toLocaleString() },
  ];

  const highlights: { icon: string; text: string; tone: NotificationSeverity }[] = [
    { icon: "CheckCircle2", text: `${succeeded.toLocaleString()} workflow${succeeded === 1 ? "" : "s"} completed`, tone: "success" },
    { icon: "TrendingUp", text: `${successRate}% success rate`, tone: settled > 0 ? "success" : "info" },
    ...(agentRuns > 0 ? [{ icon: "Bot", text: `${agentRuns.toLocaleString()} AI agent${agentRuns === 1 ? "" : "s"} executed`, tone: "info" as NotificationSeverity }] : []),
    ...(tokens > 0 ? [{ icon: "Cpu", text: `${formatTokens(tokens)} tokens consumed`, tone: "info" as NotificationSeverity }] : []),
    { icon: "Plug", text: `${integrations} integration${integrations === 1 ? "" : "s"} active`, tone: "info" },
    { icon: "Coins", text: `${creditsRemaining.toLocaleString()} credits remaining`, tone: creditsRemaining < creditLimit * 0.2 ? "warning" : "success" },
    ...(failed > 0 ? [{ icon: "AlertTriangle", text: `${failed} run${failed === 1 ? "" : "s"} failed`, tone: "error" as NotificationSeverity }] : []),
  ];

  let chart: DigestChartPoint[] | undefined;
  if (frequency === "weekly" && chartRows.length > 0) {
    const buckets = new Map<string, DigestChartPoint>();
    for (let i = 0; i < 7; i++) {
      const day = new Date(start.getTime() + i * 86_400_000);
      const key = startOfDay(day).toISOString();
      buckets.set(key, { date: day.toISOString().slice(5, 10), executions: 0, success: 0, failures: 0, tokens: 0, cost: 0 });
    }
    for (const e of chartRows) {
      const key = startOfDay(e.startedAt).toISOString();
      const b = buckets.get(key);
      if (!b) continue;
      b.executions += 1;
      if (e.status === "succeeded") b.success += 1;
      if (e.status === "failed") b.failures += 1;
      b.tokens += e.totalTokens ?? 0;
      b.cost = Math.round((b.cost + (e.totalCost ?? 0)) * 10000) / 10000;
    }
    chart = [...buckets.values()];
  }

  type WfGroup = { workflowId: string; _count: { _all: number } };
  type WfStatusGroup = { workflowId: string; status: string; _count: { _all: number } };
  let topWorkflows: DigestData["topWorkflows"];
  if (topWfGroups.length > 0) {
    const wfIds = (topWfGroups as WfGroup[]).map((g) => g.workflowId);
    const wfs = await prisma.workflow.findMany({
      where: { id: { in: wfIds }, ownerId: userId },
      select: { id: true, name: true },
    });
    const nameById = new Map(wfs.map((w) => [w.id, w.name]));
    // success rate per top workflow
    const perWf = (await prisma.execution.groupBy({
      by: ["workflowId", "status"],
      where: { ownerId: userId, workflowId: { in: wfIds }, startedAt: { gte: start, lt: end } },
      _count: { _all: true },
    })) as unknown as WfStatusGroup[];
    const okFail: Record<string, { ok: number; fail: number }> = {};
    for (const g of perWf) {
      const rec = (okFail[g.workflowId] ??= { ok: 0, fail: 0 });
      if (g.status === "succeeded") rec.ok += g._count._all;
      if (g.status === "failed") rec.fail += g._count._all;
    }
    topWorkflows = (topWfGroups as WfGroup[]).map((g) => {
      const rec = okFail[g.workflowId];
      const s = rec ? rec.ok + rec.fail : 0;
      return {
        id: g.workflowId,
        name: nameById.get(g.workflowId) ?? "Untitled workflow",
        runs: g._count._all,
        successRate: s > 0 ? Math.round((rec!.ok / s) * 100) : 100,
      };
    });
  }

  const name = await userName(userId);
  const greeting = name ? name.split(" ")[0] : "there";

  return {
    frequency: frequency as DigestFrequency,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    greeting,
    stats,
    highlights,
    chart,
    topWorkflows,
    notificationCount: notificationsCount,
  };
}

/**
 * Find digests that are due now (across all users) and enqueue them. Called from
 * the worker "tick" heartbeat and the cron route. Idempotent per
 * (user, frequency, period).
 */
export async function runDueDigests(now: Date = new Date()): Promise<{ enqueued: number }> {
  let enqueued = 0;
  for (const freq of ["hourly", "daily", "weekly"] as const) {
    // Only run daily near the top of a day, weekly on Mondays — avoids enqueuing
    // a daily digest on every 15-min tick (the digestExists guard would block it
    // anyway, but this keeps the query volume down).
    if (freq === "daily" && now.getUTCHours() !== 0) continue;
    if (freq === "weekly" && (now.getUTCDay() !== 1 || now.getUTCHours() !== 0)) continue;

    const period = computePeriod(freq, now);
    const users = await repository.listDigestDueUsers(freq);
    for (const { userId } of users) {
      const prefs = await getPreferences(userId);
      if (!digestOptedIn(prefs, freq)) continue;
      if (await repository.digestExists(userId, freq, period.start)) continue;
      const res = await enqueueDigest(userId, freq, period.start, period.end);
      if (res.queued) enqueued += 1;
    }
  }
  return { enqueued };
}

async function userName(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString();
}