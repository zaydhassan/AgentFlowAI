"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn, relativeTime } from "@/lib/utils";
import type { WorkflowSummary } from "@/lib/workflow/graph";
import type { WorkflowStatus } from "@/lib/types";

const filters: { label: string; value: WorkflowStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Paused", value: "paused" },
  { label: "Error", value: "error" },
];

const statusTone = (s: string) =>
  s === "active" ? "success" : s === "draft" ? "neutral" : s === "paused" ? "warning" : "danger";

export function WorkflowsList({ workflows }: { workflows: WorkflowSummary[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<WorkflowStatus | "all">("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const list = workflows.filter(
    (w) => (filter === "all" || w.status === filter) && w.name.toLowerCase().includes(q.toLowerCase()),
  );

  const newWorkflow = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (res.ok) {
        const { id } = await res.json();
        if (id) router.push(`/workflows/${id}`);
        return;
      }
      if (res.status === 401) router.push("/login?callbackUrl=/workflows");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="animate-float-up">
      <PageHeader
        title="Workflows"
        description={`${workflows.length} workflow${workflows.length === 1 ? "" : "s"} · ${workflows.filter((w) => w.status === "active").length} active`}
        actions={
          <>
            <Button variant="secondary" size="sm" disabled><Icon name="Upload" className="h-3.5 w-3.5" /> Import</Button>
            <Button size="sm" variant="ai" onClick={newWorkflow} disabled={creating}>
              <Icon name={creating ? "LoaderCircle" : "Plus" } className={cn("h-3.5 w-3.5", creating && "animate-spin")} /> New workflow
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search workflows…" className="pl-9" />
        </div>
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                filter === f.value ? "bg-brand-soft text-fg border-brand/30" : "border-border text-fg-muted hover:text-fg hover:bg-surface-2",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Icon name="Workflow" className="mx-auto h-8 w-8 text-fg-subtle" />
          <p className="mt-3 text-sm text-fg-muted">{workflows.length === 0 ? "You don't have any workflows yet." : "No workflows match your filters."}</p>
          {workflows.length === 0 && (
            <Button size="sm" variant="ai" className="mt-4" onClick={newWorkflow} disabled={creating}>
              <Icon name={creating ? "LoaderCircle" : "Sparkles"} className={cn("h-3.5 w-3.5", creating && "animate-spin")} /> Build your first workflow
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((w) => (
            <Link key={w.id} href={`/workflows/${w.id}`}>
              <Card className="card-hover h-full p-4">
                <div className="flex items-start justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon name="Workflow" className="h-5 w-5" />
                  </div>
                  <Badge tone={statusTone(w.status) as any}>
                    <span className={cn("dot", w.status === "active" && "dot-live")} />
                    {w.status}
                  </Badge>
                </div>
                <h3 className="mt-3 text-sm font-semibold">{w.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{w.description || "No description"}</p>

                {w.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {w.tags.map((t) => (
                      <span key={t} className="rounded-md border border-border bg-surface-2/60 px-1.5 py-0.5 text-[10px] text-fg-subtle">#{t}</span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-3 text-[11px] text-fg-subtle">
                    <span className="flex items-center gap-1"><Icon name="Clock" className="h-3 w-3" /> {w.lastRunAt ? relativeTime(w.lastRunAt) : "never"}</span>
                    <span className="flex items-center gap-1"><Icon name="GitCommit" className="h-3 w-3" /> v{w.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16">
                      <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                        <div className={cn("h-full rounded-full", w.health > 90 ? "bg-success" : w.health > 70 ? "bg-warning" : "bg-danger")} style={{ width: `${w.health}%` }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-medium tabular-nums">{w.health}%</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}