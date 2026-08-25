"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExecutionsAreaChart, CostBarChart, TokenLineChart, DonutChart } from "@/components/dashboard/charts";
import { EmptyState, type EmptyStateSpec } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { useDashboardData, useHealth } from "@/lib/hooks/use-dashboard";
import type { DashboardPayload } from "@/lib/dashboard/aggregations";
import type { CheckResult, HealthStatus } from "@/lib/health/types";
import { useDropdown } from "@/lib/hooks/use-dropdown";
import { formatNumber, formatCurrency, relativeTime, cn } from "@/lib/utils";
import { rowsToCSV, downloadCSV } from "@/lib/export";
import { UserAvatar, type UserMenuUser } from "@/components/layout/user-menu";

// Health probe name → friendly label. Probe names come from lib/health/checks.ts.
const HEALTH_ROWS: { key: string; label: string }[] = [
  { key: "postgres", label: "Database" },
  { key: "redis", label: "Cache (Redis)" },
  { key: "queue", label: "Job queue" },
  { key: "memory", label: "Memory store" },
  { key: "mcp", label: "MCP servers" },
  { key: "ai", label: "AI provider" },
  { key: "payment", label: "Payments" },
];

const EXPORT_ITEMS: {
  key: "csv" | "json" | "pdf";
  label: string;
  icon: string;
  export: (data: DashboardPayload) => void;
}[] = [
  { key: "csv", label: "Export CSV", icon: "FileText", export: exportCSV },
  { key: "json", label: "Export JSON", icon: "FileJson", export: exportJSON },
  { key: "pdf", label: "Export PDF", icon: "Printer", export: exportPDF },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data, loading, error, lastUpdated, refresh } = useDashboardData();
  const { data: health, error: healthError } = useHealth();
  // 1s ticker so "last updated Xs ago" stays live without re-fetching.
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const [creating, setCreating] = useState(false);
  const createWorkflow = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        const { id } = await res.json();
        if (id) {
          router.push(`/workflows/${id}`);
          return;
        }
      }
      if (res.status === 401) router.push("/login?callbackUrl=/dashboard");
    } finally {
      setCreating(false);
    }
  };

  if (loading && !data) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="animate-float-up space-y-4">
        <HeroSkeleton />
        <Card className="bg-surface backdrop-blur-none">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Icon name="AlertTriangle" className="h-8 w-8 text-warning" />
            <div>
              <p className="text-sm font-medium">Couldn&apos;t load your dashboard</p>
              <p className="mt-1 text-xs text-fg-muted">{error ?? "Something went wrong."}</p>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <Icon name="RefreshCw" className="h-3.5 w-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data.stats;
  const trend = data.executionTrend;

  const todayExec = trend.at(-1)?.executions ?? 0;
  const last7 = trend.slice(-7).reduce((a, d) => a + d.executions, 0);
  const execSpark = trend.map((d) => d.executions);
  const tokenSpark = trend.map((d) => d.tokens);
  const execDelta = pctDelta(trend.at(-2)?.executions, trend.at(-1)?.executions);
  const tokenDelta = pctDelta(trend.at(-2)?.tokens, trend.at(-1)?.tokens);
  const tokensInMillions = Math.round(s.tokenUsage / 1_000_000);

  // Credits: limit is derivable from remaining + % used (limit = remaining / (1 - used/100)).
  const usedPct = s.monthlyUsage;
  const creditLimit =
    usedPct < 100 ? Math.round(s.creditsRemaining / (1 - usedPct / 100)) : s.creditsRemaining;
  const remainingPct = Math.max(0, 100 - usedPct);

  const executionsEmpty = trend.every((d) => d.executions === 0);
  const tokenUsageEmpty = data.tokenBreakdown.length === 0;
  const costEmpty = s.monthlyCost === 0;
  const spendCategoryEmpty = data.costByCategory.length === 0;
  const tokenTrendEmpty = s.tokenUsage === 0;
  const apiCallsEmpty = s.apiUsage === 0;
  const runningAgentsEmpty = s.runningAgents === 0;

  const cta: EmptyStateSpec = {
    icon: "Sparkles",
    title: "",
    ctaLabel: "Create Workflow",
    onCta: createWorkflow,
  };

  return (
    <div className="animate-float-up space-y-4">
      <Hero
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? null,
          image: session?.user?.image ?? null,
        }}
        role={session?.user?.role ?? null}
        health={health?.status ?? null}
        todayExec={todayExec}
        activeWorkflows={s.activeWorkflows}
        runningAgents={s.runningAgents}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        data={data}
      />

      {/* Stale-data banner: keep showing data, but warn the latest refresh failed. */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <Icon name="AlertTriangle" className="h-3.5 w-3.5" />
          <span>
            Couldn&apos;t refresh — showing data from{" "}
            {lastUpdated ? relativeTime(new Date(lastUpdated).toISOString()) : "earlier"}.
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Executions"
          value={s.totalExecutions}
          icon="Activity"
          delta={execDelta}
          accent="#7c5cff"
          format={formatNumber}
          spark={execSpark}
          subrows={[
            { label: "Today", value: formatNumber(todayExec) },
            { label: "Last 7d", value: formatNumber(last7) },
          ]}
        />
        <StatCard
          label="Active Workflows"
          value={s.activeWorkflows}
          icon="Workflow"
          accent="#22d3ee"
          subrows={[
            { label: "Health", value: `${s.workflowsHealth}%` },
            { label: "Error", value: `${s.errorRate}%` },
          ]}
        />
        {runningAgentsEmpty ? (
          <StatCard
            label="Running Agents"
            value={0}
            icon="Bot"
            accent="#34d399"
            empty={{ ...cta, icon: "Bot", title: "No agents running", description: "Trigger a workflow to start one." }}
          />
        ) : (
          <StatCard
            label="Running Agents"
            value={s.runningAgents}
            icon="Bot"
            accent="#34d399"
            subrows={[{ label: "Across", value: `${formatNumber(s.activeWorkflows)} workflow${s.activeWorkflows === 1 ? "" : "s"}` }]}
          />
        )}
        {apiCallsEmpty ? (
          <StatCard
            label="API Calls"
            value={0}
            icon="Globe"
            accent="#f59e0b"
            empty={{ ...cta, icon: "Globe", title: "No API calls yet", description: "Usage appears here once metered." }}
          />
        ) : (
          <StatCard
            label="API Calls"
            value={s.apiUsage}
            icon="Globe"
            accent="#f59e0b"
            format={formatNumber}
            subrows={[{ label: "This period", value: formatNumber(s.apiUsage) }]}
          />
        )}
        <StatCard
          label="Credits Left"
          value={s.creditsRemaining}
          icon="Coins"
          accent="#fb7185"
          format={formatNumber}
          subrows={[
            { label: "Balance", value: `${formatNumber(s.creditsRemaining)} / ${formatNumber(creditLimit)}` },
            { label: "Remaining", value: `${remainingPct}%` },
          ]}
        />
        <StatCard
          label="Tokens (M)"
          value={tokensInMillions}
          icon="Cpu"
          suffix="M"
          delta={tokenDelta}
          accent="#a855f7"
          spark={tokenSpark}
          subrows={[{ label: "This month", value: formatNumber(s.tokenUsage) }]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashCard className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Execution Volume</CardTitle>
              <CardDescription>Last 14 days — successful vs failed runs</CardDescription>
            </div>
            <Badge tone="success">{s.successRate}% success</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {executionsEmpty ? (
                <EmptyState
                  icon="Activity"
                  title="No executions in the last 14 days"
                  description="Run a workflow to see execution volume here."
                  ctaLabel="Create Workflow"
                  onCta={createWorkflow}
                />
              ) : (
                <ExecutionsAreaChart data={trend} />
              )}
            </div>
          </CardContent>
        </DashCard>

        <DashCard>
          <CardHeader>
            <CardTitle>Token Usage by Provider</CardTitle>
            <CardDescription>{formatNumber(s.tokenUsage)} tokens this month</CardDescription>
          </CardHeader>
          <CardContent>
            {tokenUsageEmpty ? (
              <div className="flex h-44 items-center">
                <EmptyState
                  icon="Cpu"
                  title="No token usage yet"
                  description="Run your first AI workflow to start collecting usage."
                  ctaLabel="Create Workflow"
                  onCta={createWorkflow}
                />
              </div>
            ) : (
              <>
                <div className="relative h-44">
                  <DonutChart data={data.tokenBreakdown} />
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <div className="text-xl font-semibold">{formatNumber(s.tokenUsage)}</div>
                      <div className="text-[10px] text-fg-subtle">tokens</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {data.tokenBreakdown.map((t) => (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
                      <span className="text-fg-muted">{t.name}</span>
                      <span className="ml-auto font-medium">{formatNumber(t.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashCard className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cost Analytics</CardTitle>
              <CardDescription>Daily spend (USD)</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{formatCurrency(s.monthlyCost)}</div>
              <div className="text-[10px] text-fg-subtle">this month</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {costEmpty ? (
                <EmptyState
                  icon="BarChart3"
                  title="No spend yet"
                  description="Execution costs will appear here once you run workflows."
                  ctaLabel="Create Workflow"
                  onCta={createWorkflow}
                />
              ) : (
                <CostBarChart data={trend} />
              )}
            </div>
          </CardContent>
        </DashCard>

        <DashCard>
          <CardHeader>
            <CardTitle>Spend by Category</CardTitle>
            <CardDescription>Where your credits go</CardDescription>
          </CardHeader>
          <CardContent>
            {spendCategoryEmpty ? (
              <div className="flex h-32 items-center">
                <EmptyState
                  icon="PieChart"
                  title="No spend breakdown"
                  description="Category spend appears once you have usage."
                  ctaLabel="Create Workflow"
                  onCta={createWorkflow}
                />
              </div>
            ) : (
              <>
                <div className="relative h-32">
                  <DonutChart data={data.costByCategory} unit="$" />
                </div>
                <div className="mt-3 space-y-1.5">
                  {data.costByCategory.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                      <span className="text-fg-muted">{c.name}</span>
                      <span className="ml-auto font-medium">{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashCard className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Token Usage Trend</CardTitle>
            <CardDescription>Daily tokens consumed across all providers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {tokenTrendEmpty ? (
                <EmptyState
                  icon="TrendingUp"
                  title="No token trend yet"
                  description="Daily token consumption charts here after your first run."
                  ctaLabel="Create Workflow"
                  onCta={createWorkflow}
                />
              ) : (
                <TokenLineChart data={trend} />
              )}
            </div>
          </CardContent>
        </DashCard>

        <DashCard>
          <CardHeader>
            <CardTitle>Workflow Health</CardTitle>
            <CardDescription>Top workflows by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.workflows.length === 0 && (
              <div className="flex h-40 items-center">
                <EmptyState
                  icon="Workflow"
                  title="No workflows yet"
                  description="Create your first workflow to track its health."
                  ctaLabel="Create Workflow"
                  onCta={createWorkflow}
                />
              </div>
            )}
            {data.workflows.map((w, i) => {
              const name = workflowDisplayName(w.name, i);
              return (
                <div key={w.id} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "dot",
                      w.status === "active" && "bg-success dot-live",
                      w.status === "draft" && "bg-fg-subtle",
                      w.status === "paused" && "bg-warning",
                      w.status === "error" && "bg-danger dot-live",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    <div className="text-[10px] text-fg-subtle">{relativeTime(w.lastRun)}</div>
                  </div>
                  <div className="w-20">
                    <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          w.health > 90 ? "bg-success" : w.health > 70 ? "bg-warning" : "bg-danger",
                        )}
                        style={{ width: `${w.health}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-9 text-right text-xs font-medium tabular-nums">{w.health}%</span>
                </div>
              );
            })}
          </CardContent>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="ghost" size="sm">View all</Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.recentActivity.length === 0 && (
              <div className="flex h-40 items-center">
                <EmptyState
                  icon="ListTree"
                  title="No recent activity"
                  description="Workflow events and audit logs will appear here."
                  ctaLabel="Create Workflow"
                  onCta={createWorkflow}
                />
              </div>
            )}
            {data.recentActivity.map((a, i) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/60 transition-colors"
                style={{ animation: `float-up 0.4s ease ${i * 40}ms both` }}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                    a.type === "success" && "bg-success/10 text-success",
                    a.type === "info" && "bg-info/10 text-info",
                    a.type === "warning" && "bg-warning/10 text-warning",
                    a.type === "error" && "bg-danger/10 text-danger",
                  )}
                >
                  <Icon name={a.icon} className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{a.text}</div>
                  <div className="text-[11px] text-fg-subtle">{relativeTime(a.time)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </DashCard>

        <DashCard>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Workspace Status</CardTitle>
              <CardDescription>Live system health</CardDescription>
            </div>
            {health && <HealthBadge status={health.status} />}
          </CardHeader>
          <CardContent className="space-y-3">
            {healthError && !health && (
              <div className="text-xs text-fg-subtle">Health unavailable right now.</div>
            )}
            {HEALTH_ROWS.map((row) => {
              const check = health?.checks.find((c) => c.name === row.key);
              return (
                <StatusRow
                  key={row.key}
                  label={row.label}
                  value={healthValue(check)}
                  tone={healthTone(check)}
                />
              );
            })}
            <div className="mt-2 rounded-lg border border-border bg-surface-2/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-fg-muted">Error rate (30d)</span>
                <span
                  className={cn(
                    "font-medium",
                    s.errorRate > 5 ? "text-danger" : s.errorRate > 1 ? "text-warning" : "text-success",
                  )}
                >
                  {s.errorRate}%
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      s.errorRate > 5 ? "bg-danger" : s.errorRate > 1 ? "bg-warning" : "bg-success",
                    )}
                    style={{ width: `${Math.min(100, s.errorRate * 5)}%` }}
                  />
                </div>
                <span className="text-[10px] text-fg-subtle">SLO 99.5%</span>
              </div>
            </div>
          </CardContent>
        </DashCard>
      </div>
    </div>
  );
}

function Hero({
  user,
  role,
  health,
  todayExec,
  activeWorkflows,
  runningAgents,
  lastUpdated,
  onRefresh,
  data,
}: {
  user: UserMenuUser;
  role: string | null;
  health: HealthStatus | null;
  todayExec: number;
  activeWorkflows: number;
  runningAgents: number;
  lastUpdated: number | null;
  onRefresh: () => void;
  data: DashboardPayload | null;
}) {
  const greeting = timeOfDayGreeting();
  // Use the full display name (first + last), not just the first token.
  const displayName = user.name?.trim() || null;
  const healthWord =
    health === "healthy" ? "healthy" : health === "degraded" ? "degraded" : health === "unhealthy" ? "down" : "starting up";
  const badgeTone: StatusTone =
    health === "healthy" ? "success" : health === "degraded" ? "warning" : health === "unhealthy" ? "danger" : "neutral";
  const healthLabel =
    health === "healthy"
      ? "All systems operational"
      : health === "degraded"
        ? "Some systems degraded"
        : health === "unhealthy"
          ? "Systems down"
          : "Checking systems…";
  const isAdmin = role === "admin";

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="shrink-0 rounded-full ring-2 ring-border">
            <UserAvatar user={user} size="lg" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-fg sm:text-xl">
                {greeting}{displayName ? `, ${displayName}` : ""} 👋
              </h1>
              {isAdmin && (
                <Badge tone="neutral" className="shrink-0">
                  <Icon name="ShieldCheck" className="mr-1 h-3 w-3" />
                  Admin
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-fg-muted">
              <span className="text-fg">Your AI workspace is {healthWord}.</span>
              <span className="mx-1.5 text-fg-subtle">·</span>
              {formatNumber(todayExec)} today · {activeWorkflows} active · {runningAgents} running.
            </p>
            {user.email && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-fg-subtle">
                <Icon name="Mail" className="h-3 w-3" />
                {user.email}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge tone={badgeTone} className="hidden sm:inline-flex">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            {healthLabel}
          </Badge>
          {lastUpdated && (
            <span className="hidden text-[11px] text-fg-subtle md:inline">
              Updated {relativeTime(new Date(lastUpdated).toISOString())}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <Icon name="RefreshCw" className="h-3.5 w-3.5" /> Refresh
          </Button>
          <ExportMenu data={data} disabled={!data} />
        </div>
      </div>
    </section>
  );
}

function ExportMenu({ data, disabled }: { data: DashboardPayload | null; disabled: boolean }) {
  const { open, close, toggle, panelRef, triggerRef } = useDropdown<HTMLButtonElement>("dashboard-export");

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="Download" className="h-3.5 w-3.5" /> Export
        <Icon name="ChevronDown" className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
          >
            {EXPORT_ITEMS.map((it) => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                disabled={!data}
                onClick={() => {
                  if (data) it.export(data);
                  close();
                }}
                className="group flex w-full items-center gap-2.5 px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-50"
              >
                <Icon name={it.icon} className="h-3.5 w-3.5 text-fg-subtle transition-colors group-hover:text-brand" />
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

/** Percent delta of `prev` → `curr`; undefined when not computable. */
function pctDelta(prev: number | undefined, curr: number | undefined): number | undefined {
  if (prev == null || curr == null || prev === 0) return undefined;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

/** Never show "Untitled workflow" — fall back to an indexed, unique label. */
function workflowDisplayName(name: string | undefined | null, index: number): string {
  const n = (name ?? "").trim();
  if (!n || /^untitled/i.test(n)) return `Workflow #${index + 1}`;
  return n;
}

type StatusTone = "success" | "warning" | "danger" | "neutral";

function healthTone(check: CheckResult | undefined): StatusTone {
  if (!check) return "neutral";
  if (check.configured === false) return "neutral"; // intentionally absent → gray, not red
  if (check.status === "healthy") return "success";
  if (check.status === "degraded") return "warning";
  return "danger";
}

function healthValue(check: CheckResult | undefined): string {
  if (!check) return "Unknown";
  if (check.configured === false) return "Needs Setup";
  if (check.status === "healthy") return "Available";
  if (check.status === "degraded") return "Degraded";
  return "Down";
}

function HealthBadge({ status }: { status: HealthStatus }) {
  const tone = status === "healthy" ? "success" : status === "degraded" ? "warning" : "danger";
  const label = status === "healthy" ? "Healthy" : status === "degraded" ? "Degraded" : "Down";
  return <Badge tone={tone}>{label}</Badge>;
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: StatusTone }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            "dot",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-danger",
            tone === "neutral" && "bg-fg-subtle",
          )}
        />
        <span className="font-medium">{value}</span>
      </span>
    </div>
  );
}

// Solid-surface card override (no glassmorphism) — keeps the shared Card API.
function DashCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn("bg-surface backdrop-blur-none", className)} {...props} />;
}

function exportCSV(data: DashboardPayload) {
  const sections = [
    {
      title: "Summary metrics",
      csv: rowsToCSV([
        { metric: "Total executions", value: data.stats.totalExecutions },
        { metric: "Active workflows", value: data.stats.activeWorkflows },
        { metric: "Running agents", value: data.stats.runningAgents },
        { metric: "API calls", value: data.stats.apiUsage },
        { metric: "Credits remaining", value: data.stats.creditsRemaining },
        { metric: "Monthly usage (%)", value: data.stats.monthlyUsage },
        { metric: "Error rate (%)", value: data.stats.errorRate },
        { metric: "Success rate (%)", value: data.stats.successRate },
        { metric: "Monthly cost (USD)", value: data.stats.monthlyCost },
        { metric: "Token usage", value: data.stats.tokenUsage },
        { metric: "Workflows health (%)", value: data.stats.workflowsHealth },
      ]),
    },
    {
      title: "Execution trend (last 14 days)",
      csv: rowsToCSV(
        data.executionTrend.map((d) => ({
          date: d.date,
          executions: d.executions,
          succeeded: d.success,
          failed: d.failures,
          cost_usd: d.cost,
          tokens: d.tokens,
        })),
      ),
    },
    {
      title: "Token usage by provider",
      csv: rowsToCSV(data.tokenBreakdown.map((t) => ({ provider: t.name, tokens: t.value }))),
    },
    {
      title: "Cost by category",
      csv: rowsToCSV(data.costByCategory.map((c) => ({ category: c.name, cost_usd: c.value }))),
    },
    {
      title: "Recent activity",
      csv: rowsToCSV(data.recentActivity.map((a) => ({ time: a.time, type: a.type, event: a.text }))),
    },
    {
      title: "Workflow health",
      csv: rowsToCSV(
        data.workflows.map((w) => ({
          id: w.id,
          name: w.name,
          status: w.status,
          health_pct: w.health,
          last_run: w.lastRun,
        })),
      ),
    },
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`agentflow-dashboard-${stamp}.csv`, sections);
}

function exportJSON(data: DashboardPayload) {
  if (typeof document === "undefined") return;
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agentflow-dashboard-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// No PDF library — open a clean, print-ready HTML document and invoke the
// browser's print dialog (user can "Save as PDF"). Self-contained, no deps.
function exportPDF(data: DashboardPayload) {
  const win = window.open("", "_blank");
  if (!win) return;
  const esc = (v: unknown) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const table = (cols: string[], rows: Record<string, unknown>[]) =>
    `<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  const trendRows = data.executionTrend.map((d) => ({
    date: d.date,
    executions: d.executions,
    succeeded: d.success,
    failed: d.failures,
    cost_usd: d.cost,
    tokens: d.tokens,
  }));
  const s = data.stats;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>AgentFlow Dashboard — ${new Date().toISOString().slice(0, 10)}</title>
<style>
  body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b0c10;margin:32px;}
  h1{font-size:20px;margin:0 0 4px;} h2{font-size:14px;margin:24px 0 8px;color:#4b5160;}
  .muted{color:#6b7180;font-size:12px;}
  table{border-collapse:collapse;width:100%;font-size:12px;margin-top:4px;}
  th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;}
  th{background:#f7f8fa;}
  .kpis{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}
  .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;min-width:120px;}
  .kpi b{display:block;font-size:18px;}
</style></head><body>
<h1>AgentFlow Dashboard</h1>
<div class="muted">Generated ${esc(new Date().toLocaleString())}</div>
<h2>Summary</h2>
<div class="kpis">
  <div class="kpi">Total executions<b>${esc(s.totalExecutions)}</b></div>
  <div class="kpi">Active workflows<b>${esc(s.activeWorkflows)}</b></div>
  <div class="kpi">Running agents<b>${esc(s.runningAgents)}</b></div>
  <div class="kpi">API calls<b>${esc(s.apiUsage)}</b></div>
  <div class="kpi">Credits remaining<b>${esc(s.creditsRemaining)}</b></div>
  <div class="kpi">Monthly cost (USD)<b>${esc(s.monthlyCost)}</b></div>
  <div class="kpi">Token usage<b>${esc(s.tokenUsage)}</b></div>
  <div class="kpi">Success rate<b>${esc(s.successRate)}%</b></div>
</div>
<h2>Execution trend (last 14 days)</h2>${table(["date", "executions", "succeeded", "failed", "cost_usd", "tokens"], trendRows)}
<h2>Token usage by provider</h2>${table(["provider", "tokens"], data.tokenBreakdown.map((t) => ({ provider: t.name, tokens: t.value })))}
<h2>Cost by category</h2>${table(["category", "cost_usd"], data.costByCategory.map((c) => ({ category: c.name, cost_usd: c.value })))}
<h2>Workflow health</h2>${table(["id", "name", "status", "health_pct", "last_run"], data.workflows.map((w) => ({ id: w.id, name: w.name, status: w.status, health_pct: w.health, last_run: w.lastRun })))}
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function HeroSkeleton() {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-6 w-64 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-80 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-2" />
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-float-up space-y-4">
      <HeroSkeleton />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl bg-surface-2 xl:col-span-2" />
        <div className="h-80 animate-pulse rounded-xl bg-surface-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl bg-surface-2 xl:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-xl bg-surface-2 lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}