"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { ExecutionsAreaChart, CostBarChart, DonutChart } from "@/components/dashboard/charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { executionTrend, agentRuns, auditLogs } from "@/lib/mock/data";
import { cn, formatDuration, relativeTime } from "@/lib/utils";

const latency = Array.from({ length: 14 }, (_, i) => {
  const base = 1800 + Math.sin(i * 0.5) * 400;
  const j = ((i * 9301 + 49297) % 233280) / 233280 * 600;
  return { date: executionTrend[i].date, p50: Math.round(base + j), p95: Math.round((base + j) * 1.8), p99: Math.round((base + j) * 2.6) };
});

const promptVersions = [
  { id: "pv1", name: "invoice-extract", version: "v4", change: "+structured output", tokens: -8, cost: -3, status: "deployed" },
  { id: "pv2", name: "support-triage", version: "v2", change: "+few-shot examples", tokens: +12, cost: +4, status: "deployed" },
  { id: "pv3", name: "lead-qualify", version: "v3", change: "switched to Haiku", tokens: 0, cost: -41, status: "deployed" },
  { id: "pv4", name: "report-gen", version: "v1", change: "initial", tokens: 0, cost: 0, status: "draft" },
];

const apiCalls = [
  { provider: "OpenAI", calls: 2840000, errors: 410, color: "#10a37f" },
  { provider: "Claude", calls: 1920000, errors: 180, color: "#d97706" },
  { provider: "Gemini", calls: 740000, errors: 92, color: "#4285f4" },
  { provider: "Local", calls: 410000, errors: 12, color: "#64748b" },
];

export default function ObservabilityPage() {
  return (
    <div className="animate-float-up">
      <PageHeader
        title="AI Observability"
        description="Latency, cost, prompt versions, failures, retries, and reasoning traces across all agents."
        actions={<Badge tone="success"><span className="dot dot-live bg-success mr-1.5" /> live</Badge>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="p50 Latency" value={1840} icon="Gauge" suffix="ms" delta={-6.2} accent="#7c5cff" />
        <StatCard label="p99 Latency" value={4720} icon="Gauge" suffix="ms" delta={+2.1} accent="#fb7185" />
        <StatCard label="LLM Cost (mo)" value={4820} icon="DollarSign" prefix="$" delta={-8.4} accent="#34d399" />
        <StatCard label="Success Rate" value={98.2} icon="CheckCircle2" suffix="%" delta={+1.2} accent="#34d399" />
        <StatCard label="Avg Retries" value={0.18} icon="RefreshCw" suffix="" delta={-12} accent="#fbbf24" />
        <StatCard label="Mem Usage" value={68} icon="MemoryStick" suffix="%" delta={+4} accent="#22d3ee" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Execution Success vs Failure</CardTitle><CardDescription>14-day trend</CardDescription></CardHeader>
          <CardContent><div className="h-64"><ExecutionsAreaChart data={executionTrend} /></div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>LLM Provider Calls</CardTitle><CardDescription>Total this month</CardDescription></CardHeader>
          <CardContent>
            <div className="relative h-36"><DonutChart data={apiCalls.map((a) => ({ name: a.provider, value: a.calls, color: a.color }))} /></div>
            <div className="mt-3 space-y-2">
              {apiCalls.map((a) => (
                <div key={a.provider} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                  <span className="text-fg-muted">{a.provider}</span>
                  <span className="ml-auto font-medium">{(a.calls / 1_000_000).toFixed(1)}M</span>
                  <span className={cn("w-16 text-right", a.errors < 200 ? "text-success" : "text-warning")}>{a.errors} err</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Cost Trend</CardTitle><CardDescription>Daily LLM spend (USD)</CardDescription></CardHeader>
          <CardContent><div className="h-56"><CostBarChart data={executionTrend} /></div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Prompt Versions</CardTitle><CardDescription>A/B + rollback ready</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {promptVersions.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2">
                <span className={cn("grid h-7 w-7 place-items-center rounded-lg", p.status === "deployed" ? "bg-success/10 text-success" : "bg-surface-3 text-fg-subtle")}>
                  <Icon name="GitCommit" className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{p.name} <span className="text-fg-subtle">{p.version}</span></div>
                  <div className="text-[10px] text-fg-subtle">{p.change}</div>
                </div>
                <div className="text-right text-[10px]">
                  <div className={cn("font-medium", p.cost <= 0 ? "text-success" : "text-warning")}>{p.cost > 0 ? "+" : ""}{p.cost}% cost</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Agent timeline + audit */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Agent Timeline</CardTitle><CardDescription>Reasoning steps by agent</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {agentRuns.map((ar) => (
              <div key={ar.id} className="rounded-lg border border-border bg-surface-2/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon name={ar.agent === "planner" ? "Workflow" : ar.agent === "research" ? "Search" : ar.agent === "memory" ? "Brain" : "Route"} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium capitalize">{ar.agent} agent</div>
                    <div className="truncate text-[10px] text-fg-subtle">{ar.task}</div>
                  </div>
                  <Badge tone={ar.status === "done" ? "success" : ar.status === "running" ? "brand" : "danger"}>
                    {ar.status === "running" && <Icon name="LoaderCircle" className="mr-1 h-2.5 w-2.5 animate-spin" />}
                    {ar.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {ar.steps.map((s, i) => (
                    <div key={i} className="flex-1">
                      <div className={cn("h-1.5 rounded-full", s.status === "done" ? "bg-success" : s.status === "active" ? "bg-brand animate-pulse" : "bg-surface-3")} />
                      <div className="mt-1 truncate text-[9px] text-fg-subtle">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 text-[10px] text-fg-subtle">{ar.durationMs ? formatDuration(ar.durationMs) : "running…"} · {relativeTime(ar.startedAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Audit Log</CardTitle><CardDescription>Who did what, when</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {auditLogs.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/50">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[10px] font-medium">
                  {a.actor === "system" ? <Icon name="Cpu" className="h-3 w-3" /> : a.actor.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs"><span className="font-medium">{a.actor}</span> <span className="text-fg-muted">{a.action}</span> <span className="text-fg">{a.target}</span></div>
                  <div className="text-[10px] text-fg-subtle">{relativeTime(a.timestamp)} · {a.ip}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}