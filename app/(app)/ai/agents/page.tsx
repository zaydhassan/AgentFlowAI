"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { agentRuns } from "@/lib/mock/data";
import { cn, formatDuration, relativeTime } from "@/lib/utils";

const agents = [
  { icon: "Workflow", name: "Planner", color: "#7c5cff", desc: "Breaks large requests into executable subtasks and estimates cost/time.", runs: 18420, success: 99.1 },
  { icon: "Search", name: "Research", color: "#22d3ee", desc: "Browses the web, reads docs, summarizes, and extracts structured info.", runs: 9820, success: 97.4 },
  { icon: "Route", name: "AI Router", color: "#34d399", desc: "Routes each task to the optimal model by complexity, cost, and latency.", runs: 42100, success: 99.6 },
  { icon: "Brain", name: "Memory", color: "#f59e0b", desc: "Stores workflow history, user preferences, and long-term business context.", runs: 88200, success: 99.9 },
];

export default function AgentsPage() {
  return (
    <div className="animate-float-up">
      <PageHeader
        title="Agents"
        description="Your autonomous AI workforce. Each agent is specialized and observable."
        actions={<Badge tone="warning"><Icon name="FlaskConical" className="mr-1 h-3 w-3" /> Demo</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {agents.map((a) => (
          <Card key={a.name} className="card-hover p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `${a.color}22`, color: a.color }}>
                <Icon name={a.icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{a.name}</h3>
                  <Badge tone="success"><span className="dot dot-live bg-success mr-1.5" /> active</Badge>
                </div>
                <p className="mt-1 text-xs text-fg-muted">{a.desc}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-surface-2/40 p-2 text-center">
                <div className="text-sm font-semibold tabular-nums">{a.runs.toLocaleString("en-US")}</div>
                <div className="text-[10px] text-fg-subtle">runs</div>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/40 p-2 text-center">
                <div className="text-sm font-semibold text-success tabular-nums">{a.success}%</div>
                <div className="text-[10px] text-fg-subtle">success</div>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/40 p-2 text-center">
                <div className="text-sm font-semibold tabular-nums">{(a.runs * 0.04).toFixed(0)}$</div>
                <div className="text-[10px] text-fg-subtle">spend</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Recent Agent Runs</CardTitle><CardDescription>Live reasoning traces</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {agentRuns.map((ar) => (
            <div key={ar.id} className="rounded-lg border border-border bg-surface-2/40 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon name={ar.agent === "planner" ? "Workflow" : ar.agent === "research" ? "Search" : ar.agent === "memory" ? "Brain" : "Route"} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium capitalize">{ar.agent} agent</div>
                  <div className="truncate text-[10px] text-fg-subtle">{ar.task}</div>
                </div>
                <Badge tone={ar.status === "done" ? "success" : ar.status === "running" ? "brand" : "danger"}>
                  {ar.status === "running" && <Icon name="LoaderCircle" className="mr-1 h-2.5 w-2.5 animate-spin" />}
                  {ar.status}
                </Badge>
                <span className="text-[10px] text-fg-subtle">{ar.durationMs ? formatDuration(ar.durationMs) : "running"}</span>
              </div>
              <div className="mt-3 space-y-1.5 border-l border-border pl-3">
                {ar.steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full", s.status === "done" ? "bg-success/15 text-success" : s.status === "active" ? "bg-brand/15 text-brand" : "bg-surface-3 text-fg-subtle")}>
                      <Icon name={s.status === "done" ? "Check" : s.status === "active" ? "LoaderCircle" : "Circle"} className={cn("h-2.5 w-2.5", s.status === "active" && "animate-spin")} />
                    </span>
                    <span className="text-fg-muted"><span className="text-fg">{s.label}:</span> {s.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}