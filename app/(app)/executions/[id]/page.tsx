"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { executions } from "@/lib/mock/data";
import { cn, formatDuration, formatCurrency, relativeTime } from "@/lib/utils";
import type { NodeStatus } from "@/lib/types";

const statusMeta: Record<NodeStatus, { tone: any; icon: string; color: string }> = {
  idle: { tone: "neutral", icon: "Circle", color: "#6b7185" },
  running: { tone: "brand", icon: "LoaderCircle", color: "#7c5cff" },
  succeeded: { tone: "success", icon: "CheckCircle2", color: "#34d399" },
  failed: { tone: "danger", icon: "XCircle", color: "#fb7185" },
  retrying: { tone: "warning", icon: "RefreshCw", color: "#fbbf24" },
  skipped: { tone: "neutral", icon: "SkipForward", color: "#6b7185" },
};

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const ex = useMemo(() => executions.find((e) => e.id === params.id) ?? executions[0], [params.id]);
  const [replaying, setReplaying] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(ex.steps.length);
  const [visibleLogs, setVisibleLogs] = useState<Record<string, number>>({});

  // init visible logs
  useEffect(() => {
    const init: Record<string, number> = {};
    ex.steps.forEach((s) => (init[s.id] = s.logs.length));
    setVisibleLogs(init);
    setVisibleSteps(ex.steps.length);
  }, [ex]);

  const replay = () => {
    if (replaying) return;
    setReplaying(true);
    setVisibleSteps(0);
    setVisibleLogs({});
    ex.steps.forEach((step, i) => {
      setTimeout(() => setVisibleSteps(i + 1), 400 * (i + 1));
      step.logs.forEach((log, j) => {
        setTimeout(() => setVisibleLogs((p) => ({ ...p, [step.id]: (p[step.id] ?? 0) + 1 })), 400 * (i + 1) + 250 * (j + 1));
      });
    });
    setTimeout(() => setReplaying(false), 400 * ex.steps.length + ex.steps.length * 1200);
  };

  return (
    <div className="animate-float-up">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/executions" className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-surface-2">
            <Icon name="ArrowLeft" className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{ex.workflowName}</h1>
              <Badge tone={ex.status === "succeeded" ? "success" : ex.status === "failed" ? "danger" : ex.status === "running" ? "brand" : "neutral"}>
                {ex.status}
              </Badge>
            </div>
            <div className="font-mono text-[11px] text-fg-subtle">{ex.id} · {relativeTime(ex.startedAt)}</div>
          </div>
        </div>
        <Button variant="ai" size="sm" onClick={replay} disabled={replaying}>
          {replaying ? <><Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Replaying…</> : <><Icon name="Play" className="h-3.5 w-3.5" /> Replay run</>}
        </Button>
      </div>

      {/* metrics */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon="Clock" label="Duration" value={ex.durationMs ? formatDuration(ex.durationMs) : "—"} />
        <MetricCard icon="Coins" label="Cost" value={ex.totalCost ? formatCurrency(ex.totalCost) : "—"} />
        <MetricCard icon="Cpu" label="Tokens" value={ex.totalTokens ? ex.totalTokens.toLocaleString("en-US") : "—"} />
        <MetricCard icon="RefreshCw" label="Retries" value={`${ex.retried}`} />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Icon name="ListTree" className="h-4 w-4 text-brand" /> Execution Timeline
        </div>
        <div className="relative">
          <div className="absolute bottom-2 left-[19px] top-2 w-px bg-border" />
          <div className="space-y-1">
            {ex.steps.slice(0, visibleSteps).map((step, i) => {
              const m = statusMeta[step.status];
              const logsShown = visibleLogs[step.id] ?? step.logs.length;
              return (
                <div key={step.id} className="relative pl-12 py-2 animate-float-up">
                  <span
                    className="absolute left-2 top-3 grid h-9 w-9 place-items-center rounded-full border-2 bg-bg"
                    style={{ borderColor: m.color, color: m.color }}
                  >
                    <Icon name={m.icon} className={cn("h-4 w-4", step.status === "running" && "animate-spin", step.status === "retrying" && "animate-spin")} />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{step.nodeName}</span>
                    <Badge tone={m.tone}>{step.status}</Badge>
                    <span className="text-[11px] text-fg-subtle">{formatDuration(step.durationMs)}</span>
                    {step.retries > 0 && <span className="text-[11px] text-warning">↻ {step.retries}</span>}
                    {step.cost !== undefined && <span className="ml-auto text-[11px] text-fg-muted">{formatCurrency(step.cost)}</span>}
                  </div>

                  {/* reasoning */}
                  {step.reasoning && (
                    <div className="mt-2 rounded-lg border border-ai/20 bg-ai/5 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ai">
                        <Icon name="Brain" className="h-3 w-3" /> Reasoning
                      </div>
                      <ul className="space-y-1">
                        {step.reasoning.map((r, ri) => (
                          <li key={ri} className="flex items-start gap-2 text-[11px] text-fg-muted">
                            <Icon name="ChevronRight" className="mt-0.5 h-3 w-3 shrink-0 text-ai" /> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* logs */}
                  <div className="mt-2 rounded-lg border border-border bg-bg/60 p-2 font-mono text-[10px] leading-relaxed">
                    {step.logs.slice(0, logsShown).map((log, li) => (
                      <div key={li} className="py-0.5 animate-float-up">
                        <span className="text-fg-subtle">{String(li + 1).padStart(2, "0")} </span>
                        <span className="text-fg-muted">{log}</span>
                      </div>
                    ))}
                    {logsShown < step.logs.length && <div className="text-brand">▋</div>}
                  </div>
                </div>
              );
            })}
            {visibleSteps < ex.steps.length && (
              <div className="relative pl-12 py-2 text-sm text-fg-subtle">
                <span className="absolute left-2 top-3 grid h-9 w-9 place-items-center rounded-full border-2 border-border bg-bg">
                  <Icon name="LoaderCircle" className="h-4 w-4 animate-spin text-fg-subtle" />
                </span>
                awaiting next step…
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-fg-subtle">
        <Icon name={icon} className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-lg font-semibold tabular-nums">{value}</div>
    </Card>
  );
}