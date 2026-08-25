"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import type { SimulationResult, SimPathNode, SimBranch, SimFailure } from "@/lib/execution/simulate";
import type { Graph } from "@/lib/workflow/graph";

function money(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return "$" + n.toFixed(n < 1 ? 4 : 2);
}

const STATUS_META: Record<SimPathNode["status"], { label: string; dot: string; text: string }> = {
  executed: { label: "executes", dot: "bg-success", text: "text-success" },
  potential_failure: { label: "may fail", dot: "bg-amber-400", text: "text-amber-400" },
  skipped_branch: { label: "skipped branch", dot: "bg-fg-subtle", text: "text-fg-subtle" },
  skipped: { label: "unreachable", dot: "bg-fg-subtle/40", text: "text-fg-subtle/60" },
};

export function SimulationModal({
  workflowId,
  graph,
  onClose,
}: {
  workflowId: string;
  graph: Graph;
  onClose: () => void;
}) {
  const [data, setData] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"path" | "branches" | "failures">("path");

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/workflows/${workflowId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to simulate.");
      }
      const res = (await r.json()) as SimulationResult;
      setData(res);
      // Default the tab to failures if there are any, else path.
      setTab(res.failures.length > 0 ? "failures" : "path");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to simulate.");
    } finally {
      setLoading(false);
    }
  }, [workflowId, graph]);

  // Run the simulation on mount/when the graph changes; `run` is the async fetch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [run]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isFailure = data?.status === "potential_failure";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative flex h-[85vh] w-[min(48rem,95vw)] flex-col overflow-hidden rounded-2xl border border-border bg-surface-2/95 backdrop-blur-2xl shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="FlaskConical" className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold">Simulation Mode</h2>
            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-subtle">dry run · no side effects</span>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg">
            <Icon name="X" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex items-center gap-2 py-12 text-xs text-fg-subtle">
              <Icon name="LoaderCircle" className="h-4 w-4 animate-spin" /> Simulating execution path…
            </div>
          )}
          {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}
          {!loading && !error && data && <Result data={data} isFailure={isFailure} tab={tab} setTab={setTab} onRerun={run} />}
        </div>
      </motion.div>
    </div>
  );
}

function Result({ data, isFailure, tab, setTab, onRerun }: {
  data: SimulationResult;
  isFailure: boolean;
  tab: "path" | "branches" | "failures";
  setTab: (t: "path" | "branches" | "failures") => void;
  onRerun: () => void;
}) {
  if (data.empty) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-fg-subtle">
        <Icon name="Workflow" className="h-6 w-6" />
        <p className="text-xs">No nodes to simulate — add nodes to the canvas first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Banner */}
      <div className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", isFailure ? "border-amber-500/40 bg-amber-500/10" : "border-success/40 bg-success/10")}>
        <Icon name={isFailure ? "AlertTriangle" : "CheckCircle2"} className={cn("h-5 w-5 shrink-0", isFailure ? "text-amber-400" : "text-success")} />
        <div>
          <div className={cn("text-sm font-semibold", isFailure ? "text-amber-400" : "text-success")}>{data.banner}</div>
          <div className="text-[11px] text-fg-muted">
            {isFailure
              ? `${data.failures.length} potential failure${data.failures.length > 1 ? "s" : ""} detected · ${data.executedCount} of ${data.nodeCount} nodes would execute`
              : `${data.executedCount} of ${data.nodeCount} nodes would execute · no failures predicted`}
          </div>
        </div>
        <button onClick={onRerun} title="Re-run simulation" className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg">
          <Icon name="RefreshCw" className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <Stat icon="Timer" label="Est. runtime" value={formatDuration(data.estimatedRuntimeMs)} />
        <Stat icon="Coins" label="Est. cost" value={money(data.estimatedCostUsd)} />
        <Stat icon="Hash" label="Est. tokens" value={formatNumber(data.estimatedTokens)} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <Tab id="path" active={tab === "path"} onClick={setTab} icon="Route" label="Execution path" badge={data.path.length} />
        <Tab id="branches" active={tab === "branches"} onClick={setTab} icon="GitBranch" label="Branches" badge={data.branches.length} />
        <Tab id="failures" active={tab === "failures"} onClick={setTab} icon="AlertTriangle" label="Failures" badge={data.failures.length} danger={data.failures.length > 0} />
      </div>

      {tab === "path" && <PathView path={data.path} />}
      {tab === "branches" && <BranchesView branches={data.branches} />}
      {tab === "failures" && <FailuresView failures={data.failures} />}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-3/40 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-subtle"><Icon name={icon} className="h-3 w-3" /> {label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Tab({ id, active, onClick, icon, label, badge, danger }: {
  id: "path" | "branches" | "failures";
  active: boolean;
  onClick: (t: "path" | "branches" | "failures") => void;
  icon: string;
  label: string;
  badge: number;
  danger?: boolean;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        "flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors",
        active ? "border-brand text-fg" : "border-transparent text-fg-muted hover:text-fg",
      )}
    >
      <Icon name={icon} className="h-3.5 w-3.5" /> {label}
      <span className={cn("rounded px-1 text-[9px]", danger && badge > 0 ? "bg-amber-500/20 text-amber-400" : "bg-surface-3 text-fg-muted")}>{badge}</span>
    </button>
  );
}

function PathView({ path }: { path: SimPathNode[] }) {
  if (path.length === 0) return <Empty text="No execution path." />;
  return (
    <div className="space-y-1 pt-1">
      {path.map((n, i) => {
        const meta = STATUS_META[n.status];
        const dim = n.status === "skipped_branch" || n.status === "skipped";
        return (
          <div key={n.nodeId} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5", dim ? "border-border/50 bg-surface-2/30 opacity-60" : n.status === "potential_failure" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-surface-3/30")}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface-3 text-[10px] font-semibold text-fg-muted">{i + 1}</span>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
            <span className="min-w-0 flex-1">
              <span className="truncate text-xs font-medium">{n.label}</span>
              <span className="ml-1.5 text-[10px] text-fg-subtle">{n.type}</span>
              {n.isBranch && <span className="ml-1.5 rounded bg-brand/15 px-1 text-[9px] text-brand">→ {n.branchTakenTargetLabel}</span>}
            </span>
            {n.status === "executed" || n.status === "potential_failure" ? (
              <span className="shrink-0 flex items-center gap-2 text-[10px] text-fg-muted">
                <span>{formatDuration(n.durationMs)}</span>
                {n.tokens > 0 && <span>{formatNumber(n.tokens)}t</span>}
                {n.costUsd > 0 && <span>{money(n.costUsd)}</span>}
              </span>
            ) : (
              <span className={cn("shrink-0 text-[10px]", meta.text)}>{meta.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BranchesView({ branches }: { branches: SimBranch[] }) {
  if (branches.length === 0) return <Empty text="No conditional branches in this workflow." />;
  return (
    <div className="space-y-2 pt-1">
      {branches.map((b) => (
        <div key={b.nodeId} className="rounded-lg border border-border bg-surface-3/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Icon name="GitBranch" className="h-3.5 w-3.5 text-brand" /> {b.label}
            <span className="text-[10px] text-fg-subtle">· {b.type}</span>
          </div>
          <div className="mt-1.5 space-y-1 text-[11px]">
            <div className="flex items-center gap-1.5 text-success">
              <Icon name="Check" className="h-3 w-3 shrink-0" />
              <span className="font-medium">Taken:</span>
              <span className="truncate">{b.takenTargetLabel}</span>
            </div>
            {b.alternatives.length > 0 && (
              <div className="flex items-start gap-1.5 text-fg-subtle">
                <Icon name="X" className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="font-medium">Skipped:</span>
                <span className="truncate">{b.alternatives.map((a) => a.targetLabel).join(", ")}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FailuresView({ failures }: { failures: SimFailure[] }) {
  if (failures.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-fg-subtle">
        <Icon name="CheckCircle2" className="h-6 w-6 text-success" />
        <p className="text-xs">No potential failures predicted along the execution path.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 pt-1">
      {failures.map((f) => (
        <div key={f.nodeId} className={cn("rounded-lg border px-3 py-2", f.severity === "hard" ? "border-danger/30 bg-danger/5" : "border-amber-500/30 bg-amber-500/5")}>
          <div className="flex items-center gap-1.5">
            <Icon name={f.severity === "hard" ? "AlertOctagon" : "AlertTriangle"} className={cn("h-3.5 w-3.5", f.severity === "hard" ? "text-danger" : "text-amber-400")} />
            <span className="text-xs font-medium">{f.label}</span>
            <span className="text-[10px] text-fg-subtle">· {f.type}</span>
            <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", f.severity === "hard" ? "bg-danger/15 text-danger" : "bg-amber-500/15 text-amber-400")}>
              {f.severity}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-fg-muted">{f.reason}</div>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-xs text-fg-subtle">{text}</div>;
}