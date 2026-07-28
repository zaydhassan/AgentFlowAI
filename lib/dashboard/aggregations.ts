// Dashboard aggregations — the single place dashboard metrics are computed from
// the DB. Called by app/api/dashboard/route.ts under a per-user cache (60s).
//
// Everything is scoped to one owner (ownerId / userId = the signed-in user).
// Metrics that aren't fully tracked in the schema today are derived honestly:
//   - tokenBreakdown by provider: heuristic from ExecutionStep.nodeName keyword
//     match, with a single-bucket fallback (no fabricated split).
//   - costByCategory: only "AI inference" is a real $ figure (sum of
//     Execution.totalCost this month); API/Storage/Compute come from Usage
//     counters and appear only when non-zero (no invented $ amounts).
//   - creditsRemaining: PLAN_CREDIT_LIMIT[plan] - Usage.aiCredits this period.
//     Usage metering is not yet wired to executions, so aiCredits may be 0 —
//     in which case creditsRemaining equals the full plan limit (real, unmetered).
//
// "server-only" so this never leaks into a client bundle.

import "server-only";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentUsage } from "@/lib/usage";
import { PLAN_CREDIT_LIMIT } from "@/lib/payments/plans";
import type { PlanId } from "@/lib/payments/types";

// ─────────────────────────── types ───────────────────────────────────────────
export interface DashboardStats {
  totalExecutions: number;
  activeWorkflows: number;
  runningAgents: number;
  apiUsage: number;
  creditsRemaining: number;
  monthlyUsage: number; // %
  errorRate: number; // %
  successRate: number; // %
  monthlyCost: number;
  tokenUsage: number;
  workflowsHealth: number; // %
}

export interface TrendPoint {
  date: string;
  executions: number;
  success: number;
  failures: number;
  cost: number;
  tokens: number;
}

export interface NamedSlice {
  name: string;
  value: number;
  color: string;
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string; // ISO
  type: "success" | "info" | "warning" | "error";
  icon: string;
}

export interface WorkflowHealthRow {
  id: string;
  name: string;
  status: string;
  lastRun: string; // ISO
  health: number; // 0-100
}

export interface DashboardPayload {
  stats: DashboardStats;
  executionTrend: TrendPoint[];
  tokenBreakdown: NamedSlice[];
  costByCategory: NamedSlice[];
  recentActivity: ActivityItem[];
  workflows: WorkflowHealthRow[];
  /** Unread notification count (additive — drives the dashboard's notif panel). */
  notifications: { unread: number };
  generatedAt: string;
}

// ─────────────────────────── palette ─────────────────────────────────────────
// Colors reused from lib/mock/data.ts so the charts look consistent.
const TOKEN_COLORS = {
  OpenAI: "#10a37f",
  Claude: "#d97706",
  Gemini: "#4285f4",
  Local: "#64748b",
} as const;

const COST_COLORS = {
  "AI inference": "#7c5cff",
  "API calls": "#22d3ee",
  Storage: "#10a98f",
  Compute: "#f59e0b",
} as const;

// ─────────────────────────── helpers ─────────────────────────────────────────
const TREND_DAYS = 14;
const RATE_WINDOW_DAYS = 30;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function monthWindow(now: Date): { start: Date; end: Date } {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function safeDiv(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

/** Classify a node name into a provider bucket for the token-breakdown donut. */
function providerBucket(nodeName: string): keyof typeof TOKEN_COLORS {
  const n = nodeName.toLowerCase();
  if (/openai|gpt|^o[1-9]|chatgpt/.test(n)) return "OpenAI";
  if (/claude|anthropic/.test(n)) return "Claude";
  if (/gemini|google|bard|palm/.test(n)) return "Gemini";
  return "Local";
}

/** Map an AuditLog action string to a {type, icon} for the activity feed. */
function classifyAction(action: string): { type: ActivityItem["type"]; icon: string } {
  const a = action.toLowerCase();
  if (/fail|error|quota|denied|invalid|expired/.test(a)) return { type: "error", icon: "AlertTriangle" };
  if (/warn|retry|self-heal|degrad|recover/.test(a)) return { type: "warning", icon: "Wrench" };
  if (/publish|create|invited|success|completed|enabled|activated|run|executed/.test(a))
    return { type: "success", icon: "CheckCircle2" };
  return { type: "info", icon: "Activity" };
}

/** Build a human line for an audit log row, appending a target if present. */
function activityText(action: string, metadata: unknown): string {
  if (metadata && typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    const target = m.target ?? m.workflowName ?? m.name ?? m.resource;
    if (typeof target === "string" && target.trim()) return `${action}: ${target}`;
  }
  return action;
}

// ─────────────────────────── main ────────────────────────────────────────────
export async function buildDashboard(userId: string): Promise<DashboardPayload> {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthWindow(now);
  const trendStart = new Date(startOfDay(now).getTime() - (TREND_DAYS - 1) * 86_400_000);
  const rateStart = new Date(startOfDay(now).getTime() - (RATE_WINDOW_DAYS - 1) * 86_400_000);

  // Resolve plan + current-period usage (upserts a zeroed row if missing).
  const [sub, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId }, select: { plan: true } }),
    getOrCreateCurrentUsage(userId),
  ]);
  const plan = (sub?.plan as PlanId) ?? "free";
  const creditLimit = PLAN_CREDIT_LIMIT[plan] ?? PLAN_CREDIT_LIMIT.free;
  const usedCredits = usage.aiCredits ?? 0;
  const creditsRemaining = Math.max(0, creditLimit - usedCredits);
  const monthlyUsage = Math.min(100, Math.round(safeDiv(usedCredits, creditLimit) * 100));

  // Independent counts/sums in parallel.
  const [
    totalExecutions,
    activeWorkflows,
    runningExecutions,
    monthlyAgg,
    rateGroups,
    trendRows,
    auditRows,
    topWorkflows,
    wfRateGroups,
    stepRows,
    unreadNotifications,
  ] = await Promise.all([
    prisma.execution.count({ where: { ownerId: userId } }),
    prisma.workflow.count({ where: { ownerId: userId, status: "active" } }),
    prisma.execution.count({ where: { ownerId: userId, status: "running" } }),
    prisma.execution.aggregate({
      where: { ownerId: userId, startedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { totalCost: true, totalTokens: true },
    }),
    prisma.execution.groupBy({
      by: ["status"],
      where: { ownerId: userId, startedAt: { gte: rateStart } },
      _count: { _all: true },
    }),
    prisma.execution.findMany({
      where: { ownerId: userId, startedAt: { gte: trendStart } },
      select: { status: true, startedAt: true, totalCost: true, totalTokens: true },
      orderBy: { startedAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, action: true, metadata: true, createdAt: true },
    }),
    prisma.workflow.findMany({
      where: { ownerId: userId },
      orderBy: [{ lastRunAt: { sort: "desc", nulls: "last" } }],
      take: 5,
      select: { id: true, name: true, status: true, lastRunAt: true, createdAt: true },
    }),
    prisma.execution.groupBy({
      by: ["workflowId", "status"],
      where: { ownerId: userId, startedAt: { gte: rateStart } },
      _count: { _all: true },
    }),
    prisma.executionStep.findMany({
      where: { execution: { ownerId: userId, startedAt: { gte: monthStart, lte: monthEnd } } },
      select: { nodeName: true, tokensUsed: true },
    }),
    // Additive: unread notification count for the dashboard's notification panel.
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  // ── success / error rate over the 30d window ──
  const rateCount: Record<string, number> = {};
  for (const g of rateGroups) rateCount[g.status] = g._count._all;
  const succeeded = rateCount.succeeded ?? 0;
  const failed = rateCount.failed ?? 0;
  const settled = succeeded + failed;
  const successRate = Math.round(safeDiv(succeeded, settled) * 1000) / 10; // 1 decimal
  const errorRate = Math.round(safeDiv(failed, settled) * 1000) / 10;

  const monthlyCost = round2(monthlyAgg._sum.totalCost ?? 0);
  const tokenUsage = monthlyAgg._sum.totalTokens ?? 0;

  // ── 14-day trend (in-memory day bucketing) ──
  const buckets = new Map<string, TrendPoint>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const day = new Date(trendStart.getTime() + i * 86_400_000);
    const key = startOfDay(day).toISOString();
    buckets.set(key, {
      date: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      executions: 0,
      success: 0,
      failures: 0,
      cost: 0,
      tokens: 0,
    });
  }
  for (const e of trendRows) {
    const key = startOfDay(e.startedAt).toISOString();
    const b = buckets.get(key);
    if (!b) continue;
    b.executions += 1;
    if (e.status === "succeeded") b.success += 1;
    if (e.status === "failed") b.failures += 1;
    b.cost = round2(b.cost + (e.totalCost ?? 0));
    b.tokens += e.totalTokens ?? 0;
  }
  const executionTrend = [...buckets.values()];

  // ── token breakdown by provider (heuristic) ──
  const tokenSums: Record<string, number> = { OpenAI: 0, Claude: 0, Gemini: 0, Local: 0 };
  let classifiedTokens = 0;
  for (const s of stepRows) {
    const bucket = providerBucket(s.nodeName ?? "");
    const t = s.tokensUsed ?? 0;
    tokenSums[bucket] += t;
    classifiedTokens += t;
  }
  let tokenBreakdown: NamedSlice[];
  if (classifiedTokens > 0) {
    tokenBreakdown = (Object.keys(tokenSums) as (keyof typeof TOKEN_COLORS)[])
      .filter((k) => tokenSums[k] > 0)
      .map((k) => ({ name: k, value: tokenSums[k], color: TOKEN_COLORS[k] }));
  } else if (tokenUsage > 0) {
    // No step-level data to classify — fall back to a single honest bucket.
    tokenBreakdown = [{ name: "AI tokens", value: tokenUsage, color: TOKEN_COLORS.Local }];
  } else {
    tokenBreakdown = [];
  }

  // ── cost by category ──
  // Only "AI inference" is a real $ figure (sum of Execution.totalCost this
  // month). API/Storage/Compute are metered as unitless Usage counters with no
  // dollar rate defined anywhere in the codebase, so we omit them rather than
  // invent a $ amount. When metering + rates land, add those slices here.
  const costByCategory: NamedSlice[] =
    monthlyCost > 0
      ? [{ name: "AI inference", value: monthlyCost, color: COST_COLORS["AI inference"] }]
      : [];

  // ── recent activity from audit logs ──
  const recentActivity: ActivityItem[] = auditRows.map((a) => {
    const { type, icon } = classifyAction(a.action);
    return {
      id: a.id,
      text: activityText(a.action, a.metadata),
      time: a.createdAt.toISOString(),
      type,
      icon,
    };
  });

  // ── workflow health rows ──
  // Per-workflow success rate over the 30d window, joined to the top-5 workflows.
  const wfSuccess: Record<string, { ok: number; fail: number }> = {};
  for (const g of wfRateGroups) {
    const rec = (wfSuccess[g.workflowId] ??= { ok: 0, fail: 0 });
    if (g.status === "succeeded") rec.ok += g._count._all;
    if (g.status === "failed") rec.fail += g._count._all;
  }
  const workflows: WorkflowHealthRow[] = topWorkflows.map((w) => {
    const rec = wfSuccess[w.id];
    const settled = rec ? rec.ok + rec.fail : 0;
    const health = settled > 0 ? Math.round(safeDiv(rec!.ok, settled) * 100) : 100;
    return {
      id: w.id,
      name: w.name,
      status: w.status,
      lastRun: (w.lastRunAt ?? w.createdAt).toISOString(),
      health,
    };
  });

  const stats: DashboardStats = {
    totalExecutions,
    activeWorkflows,
    runningAgents: runningExecutions,
    apiUsage: usage.apiCalls ?? 0,
    creditsRemaining,
    monthlyUsage,
    errorRate,
    successRate,
    monthlyCost,
    tokenUsage,
    workflowsHealth: Math.round(successRate),
  };

  return {
    stats,
    executionTrend,
    tokenBreakdown,
    costByCategory,
    recentActivity,
    workflows,
    notifications: { unread: unreadNotifications },
    generatedAt: now.toISOString(),
  };
}