"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { executions } from "@/lib/mock/data";
import { cn, formatDuration, formatCurrency, relativeTime } from "@/lib/utils";
import type { ExecutionStatus } from "@/lib/types";

const tone = (s: ExecutionStatus) =>
  s === "succeeded" ? "success" : s === "failed" ? "danger" : s === "running" ? "brand" : s === "retrying" ? "warning" : s === "queued" ? "neutral" : "danger";

export default function ExecutionsPage() {
  const [q, setQ] = useState("");
  const list = executions.filter((e) => e.workflowName.toLowerCase().includes(q.toLowerCase()) || e.id.includes(q));

  return (
    <div className="animate-float-up">
      <PageHeader
        title="Executions"
        description="Live and historical workflow runs. Real-time logs, retries, and self-healing."
      />

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Icon name="Search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by workflow or run id…" className="pl-9" />
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5"><span className="dot dot-live bg-brand" /> 1 running</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5"><span className="dot bg-success" /> {executions.filter((e) => e.status === "succeeded").length} succeeded</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5"><span className="dot bg-danger" /> {executions.filter((e) => e.status === "failed").length} failed</span>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 border-b border-border px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
          <div className="col-span-3">Run</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Trigger</div>
          <div className="col-span-1">Retries</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-1">Tokens</div>
          <div className="col-span-1 text-right">Cost</div>
        </div>
        <div className="divide-y divide-border">
          {list.map((e) => (
            <Link
              key={e.id}
              href={`/executions/${e.id}`}
              className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-surface-2/50 transition-colors"
            >
              <div className="col-span-3 min-w-0">
                <div className="flex items-center gap-2">
                  {e.status === "running" ? <Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin text-brand" /> : <Icon name="Activity" className="h-3.5 w-3.5 text-fg-subtle" />}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.workflowName}</div>
                    <div className="font-mono text-[10px] text-fg-subtle">{e.id} · {relativeTime(e.startedAt)}</div>
                  </div>
                </div>
              </div>
              <div className="col-span-2"><Badge tone={tone(e.status) as any}>{e.status}</Badge></div>
              <div className="col-span-2 text-fg-muted">{e.trigger}</div>
              <div className="col-span-1 text-fg-muted">{e.retried > 0 ? <span className="text-warning">↻{e.retried}</span> : "—"}</div>
              <div className="col-span-2 tabular-nums text-fg-muted">{e.durationMs ? formatDuration(e.durationMs) : "—"}</div>
              <div className="col-span-1 tabular-nums text-fg-muted">{e.totalTokens ? e.totalTokens.toLocaleString("en-US") : "—"}</div>
              <div className="col-span-1 text-right tabular-nums text-fg-muted">{e.totalCost ? formatCurrency(e.totalCost) : "—"}</div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}