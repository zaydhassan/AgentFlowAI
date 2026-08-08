"use client";

// AI Observability — real + real-time.
//
// Pulls an aggregated, owner-scoped snapshot from GET /api/observability
// (polled 10s + on focus) and animates in-flight runs via the existing
// per-execution SSE stream. See lib/observability/use-observability.ts. All
// data is live; nothing here is mocked.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { ExecutionsAreaChart, CostBarChart, DonutChart } from "@/components/dashboard/charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState, type EmptyStateSpec } from "@/components/dashboard/empty-state";
import { useObservability, type LiveRunState } from "@/lib/observability/use-observability";
import type { InFlightRun, RecentExecutionRow } from "@/lib/observability/types";
import { cn, formatCurrency, formatDuration, formatNumber, relativeTime } from "@/lib/utils";

const tone = (s: string) =>
  s === "succeeded" ? "success" : s === "failed" ? "danger" : s === "running" ? "brand" : s === "paused" ? "warning" : "neutral";

export default function ObservabilityPage() {
  const router = useRouter();
  const { summary, live, loading, error, refresh } = useObservability();

  const emptySpec: EmptyStateSpec = {
    icon: "Gauge",
    title: "No executions yet",
    description: "Run a workflow to see latency, cost, and live traces here.",
    ctaLabel: "Browse workflows",
    onCta: () => router.push("/workflows"),
  };

  if (loading && !summary) {
    return (
      <div className="animate-float-up">
        <PageHeader
          title="AI Observability"
          description="Latency, cost, prompt versions, failures, retries, and reasoning traces across all agents."
          actions={<Badge tone="success"><span className="dot dot-live bg-success mr-1.5" /> live</Badge>}
        />
        <Card>
          <CardContent className="py-16">
            <EmptyState icon="Activity" title="Loading observability…" description="Fetching live metrics and recent runs." />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="animate-float-up">
        <PageHeader title="AI Observability" description="Latency, cost, prompt versions, failures, retries, and reasoning traces across all agents." />
        <Card>
          <CardContent className="py-16">
            <EmptyState
              icon="AlertTriangle"
              title="Couldn’t load observability"
              description={error}
              ctaLabel="Retry"
              onCta={() => refresh()}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const k = summary?.kpis;
  const hasData = summary?.hasData ?? false;
  const empty = !hasData;

  return (
    <div className="animate-float-up">
      <PageHeader
        title="AI Observability"
        description="Latency, cost, prompt versions, failures, retries, and reasoning traces across all agents."
        actions={<Badge tone="success"><span className="dot dot-live bg-success mr-1.5" /> live</Badge>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="p50 Latency" value={k?.p50LatencyMs ?? 0} icon="Gauge" suffix="ms" accent="#7c5cff" empty={k?.p50LatencyMs == null ? emptySpec : undefined} />
        <StatCard label="p99 Latency" value={k?.p99LatencyMs ?? 0} icon="Gauge" suffix="ms" accent="#fb7185" empty={k?.p99LatencyMs == null ? emptySpec : undefined} />
        <StatCard label="LLM Cost (30d)" value={k?.cost30d ?? 0} icon="DollarSign" prefix="$" accent="#34d399" empty={empty ? emptySpec : undefined} />
        <StatCard label="Success Rate" value={k?.successRate ?? 0} icon="CheckCircle2" suffix="%" accent="#34d399" empty={k?.successRate == null ? emptySpec : undefined} />
        <StatCard label="Avg Retries" value={k?.avgRetries ?? 0} icon="RefreshCw" accent="#fbbf24" empty={k?.avgRetries == null ? emptySpec : undefined} />
        <StatCard
          label="Running Now"
          value={k?.runningNow ?? 0}
          icon="Activity"
          accent="#22d3ee"
          subrows={[
            { label: "active workflows", value: String(k?.activeWorkflows ?? 0) },
            { label: "execs 30d", value: String(k?.executions30d ?? 0) },
          ]}
        />
      </div>

      {/* Trend + AI node distribution */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Execution Success vs Failure</CardTitle><CardDescription>14-day trend</CardDescription></CardHeader>
          <CardContent>
            <div className="h-64">
              {empty ? <EmptyState icon="Activity" title="No runs yet" description="Execution volume will chart here once workflows run." /> : <ExecutionsAreaChart data={summary!.trend} />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>AI Node Calls</CardTitle><CardDescription>By node type · last 30d</CardDescription></CardHeader>
          <CardContent>
            {empty || !summary!.aiNodeDistribution.length ? (
              <div className="flex h-44 items-center justify-center">
                <EmptyState compact icon="Workflow" title="No AI node calls" description="Runs with AI nodes will appear here." />
              </div>
            ) : (
              <>
                <div className="relative h-36"><DonutChart data={summary!.aiNodeDistribution.map((a) => ({ name: a.name, value: a.value, color: a.color }))} /></div>
                <div className="mt-3 space-y-2">
                  {summary!.aiNodeDistribution.map((a) => (
                    <div key={a.nodeType} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                      <span className="text-fg-muted">{a.name}</span>
                      <span className="ml-auto font-medium">{formatNumber(a.value)}</span>
                      <span className="w-20 text-right text-fg-subtle">{formatNumber(a.tokens)} tok</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost trend + prompt versions */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Cost Trend</CardTitle><CardDescription>Daily LLM spend (USD)</CardDescription></CardHeader>
          <CardContent>
            <div className="h-56">
              {empty ? <EmptyState icon="DollarSign" title="No spend yet" description="Daily LLM cost will chart here once runs execute." /> : <CostBarChart data={summary!.trend} />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Prompt Versions</CardTitle><CardDescription>Recent workflow versions</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {!summary!.promptVersions.length ? (
              <div className="py-8 text-center text-xs text-fg-subtle">No saved versions yet.</div>
            ) : (
              summary!.promptVersions.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon name="GitCommit" className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{p.workflowName} <span className="text-fg-subtle">v{p.version}</span></div>
                    <div className="truncate text-[10px] text-fg-subtle">{p.message || "—"}</div>
                  </div>
                  <div className="text-right text-[10px] text-fg-subtle">
                    <div>{p.createdBy || "—"}</div>
                    <div>{relativeTime(p.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live + recent executions / audit log */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Executions</CardTitle>
            <CardDescription>Live runs + recent history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {empty ? (
              <div className="py-8 text-center text-xs text-fg-subtle">No executions yet.</div>
            ) : (
              <>
                {/* Live (in-flight) */}
                {summary!.inFlight.map((run) => (
                  <LiveRunRow key={run.executionId} run={run} state={live[run.executionId]} />
                ))}

                {/* Recent (finished) */}
                {summary!.recent.map((e) => (
                  <RecentRow key={e.id} e={e} />
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Audit Log</CardTitle><CardDescription>Who did what, when</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {!summary!.auditLogs.length ? (
              <div className="py-8 text-center text-xs text-fg-subtle">No audit entries yet.</div>
            ) : (
              summary!.auditLogs.map((a) => {
                const actor = a.actor ?? "system";
                const isSystem = actor === "system";
                return (
                  <div key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/50">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[10px] font-medium">
                      {isSystem ? <Icon name="Cpu" className="h-3 w-3" /> : actor.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs">
                        <span className="font-medium">{actor}</span> <span className="text-fg-muted">{a.action}</span>{a.target ? <span className="text-fg"> {a.target}</span> : null}
                      </div>
                      <div className="text-[10px] text-fg-subtle">{relativeTime(a.createdAt)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LiveRunRow({ run, state }: { run: InFlightRun; state?: LiveRunState }) {
  const status = state?.status ?? "running";
  return (
    <div className="rounded-lg border border-brand/30 bg-brand-soft/20 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name="Workflow" className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{run.workflowName}</div>
          <div className="truncate text-[10px] text-fg-subtle">{run.trigger} · {relativeTime(run.startedAt)}</div>
        </div>
        <Badge tone={status === "running" ? "brand" : status === "succeeded" ? "success" : "danger"}>
          {status === "running" && <Icon name="LoaderCircle" className="mr-1 h-2.5 w-2.5 animate-spin" />}
          {status}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {state && state.steps.length > 0 ? (
          state.steps.map((s, i) => (
            <div key={`${s.nodeId}-${i}`} className="flex-1">
              <div className={cn("h-1.5 rounded-full", s.status === "succeeded" ? "bg-success" : s.status === "failed" ? "bg-danger" : "bg-brand animate-pulse")} />
              <div className="mt-1 truncate text-[9px] text-fg-subtle">{s.nodeName}</div>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
            <Icon name="LoaderCircle" className="h-3 w-3 animate-spin" /> starting…
          </div>
        )}
      </div>
    </div>
  );
}

function RecentRow({ e }: { e: RecentExecutionRow }) {
  return (
    <Link href={`/executions/${e.id}`} className="block rounded-lg px-2 py-2 hover:bg-surface-2/50 transition-colors">
      <div className="flex items-center gap-2">
        {e.status === "running" ? (
          <Icon name="LoaderCircle" className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" />
        ) : (
          <Icon name="Activity" className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{e.workflowName}</div>
          <div className="font-mono text-[10px] text-fg-subtle">
            {e.id} · {relativeTime(e.startedAt)} · {e.stepCount} steps
            {e.durationMs ? ` · ${formatDuration(e.durationMs)}` : ""}
            {e.totalCost ? ` · ${formatCurrency(e.totalCost)}` : ""}
          </div>
        </div>
        <Badge tone={tone(e.status) as any}>{e.status}</Badge>
      </div>
      {e.error && <div className="mt-1 truncate pl-6 text-[10px] text-danger">{e.error}</div>}
    </Link>
  );
}