"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import type { EstimateResponse, ProviderEstimate, Recommendation, Strategy, NodeEstimate } from "@/lib/ai/optimizer";

function money(n: number | null): string {
  if (n == null) return "Unknown";
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return "$" + n.toFixed(n < 1 ? 4 : 2);
}
function latency(ms: number | null): string {
  if (ms == null) return "Unknown";
  return formatDuration(ms);
}
function confPct(c: number): string {
  return `${Math.round(c * 100)}%`;
}

const STRATEGIES: { id: Strategy; label: string; icon: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", icon: "Scale", hint: "Best cost/latency trade-off" },
  { id: "cost", label: "Cheapest", icon: "BadgeDollarSign", hint: "Lowest estimated cost" },
  { id: "fast", label: "Fastest", icon: "Zap", hint: "Lowest estimated latency" },
];

export function CostOptimizer({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const [strategy, setStrategy] = useState<Strategy>("balanced");
  const [data, setData] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNodes, setShowNodes] = useState(false);

  const load = useCallback(async (s: Strategy) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/workflows/${workflowId}/estimate?strategy=${s}`);
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to estimate.");
      }
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to estimate.");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { void load(strategy); }, [load, strategy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rec = data?.recommended ?? null;

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
            <Icon name="Calculator" className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold">AI Cost Optimizer</h2>
            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-subtle">preflight</span>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg">
            <Icon name="X" className="h-4 w-4" />
          </button>
        </div>

        {/* Strategy toggle */}
        <div className="border-b border-border px-4 py-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                title={s.hint}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  strategy === s.id ? "border-brand/50 bg-brand-soft/40 text-fg" : "border-border bg-surface-3/40 text-fg-muted hover:text-fg",
                )}
              >
                <Icon name={s.icon} className="h-3.5 w-3.5" /> {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex items-center gap-2 py-10 text-xs text-fg-subtle">
              <Icon name="LoaderCircle" className="h-4 w-4 animate-spin" /> Estimating…
            </div>
          )}
          {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}
          {!loading && !error && data && (
            <Body data={data} rec={rec} showNodes={showNodes} setShowNodes={setShowNodes} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Body({ data, rec, showNodes, setShowNodes }: {
  data: EstimateResponse;
  rec: Recommendation | null;
  showNodes: boolean;
  setShowNodes: (v: boolean) => void;
}) {
  if (data.unknown || data.aiNodeCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-fg-subtle">
        <Icon name="Sparkles" className="h-6 w-6" />
        <p className="text-xs">No AI nodes in this workflow — nothing to estimate.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recommended banner */}
      <div className={cn("rounded-xl border px-3 py-2.5", rec ? "border-brand/40 bg-brand-soft/30" : "border-border bg-surface-3/40")}>
        {rec ? (
          <div className="flex items-center gap-3">
            <Icon name="CheckCircle2" className="h-5 w-5 shrink-0 text-brand" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">Recommended</div>
              <div className="text-sm font-semibold">
                {rec.providerLabel} · {rec.modelLabel}
                <span className="ml-2 text-xs font-normal text-fg-muted">≈ {money(rec.costUsd)} · {latency(rec.latencyMs)} · {confPct(rec.confidence)} confidence</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-fg-muted">No eligible provider configured. Set an API key (e.g. <code className="text-fg">OPENAI_API_KEY</code>) to get a recommendation.</div>
        )}
      </div>

      {/* Three recommendations */}
      <div className="grid grid-cols-3 gap-2">
        <RecCard title="Cheapest" icon="BadgeDollarSign" rec={data.recommendations.cheapest} />
        <RecCard title="Fastest" icon="Zap" rec={data.recommendations.fastest} />
        <RecCard title="Balanced" icon="Scale" rec={data.recommendations.balanced} />
      </div>

      {/* Per-provider cards */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
          Provider comparison <span className="rounded bg-surface-3 px-1 text-[9px] text-fg-muted">{data.estimates.length}</span>
        </div>
        <div className="space-y-1.5">
          {data.estimates.map((e) => (
            <ProviderCard key={e.providerId} e={e} isRec={rec?.providerId === e.providerId} />
          ))}
        </div>
      </div>

      {/* Per-node breakdown */}
      <div>
        <button onClick={() => setShowNodes(!showNodes)} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle hover:text-fg">
          <Icon name="ChevronRight" className={cn("h-3 w-3 transition-transform", showNodes && "rotate-90")} />
          Per-node breakdown · {data.nodes.length} AI node{data.nodes.length > 1 ? "s" : ""}
        </button>
        {showNodes && (
          <div className="mt-1.5 space-y-1">
            {data.nodes.map((n) => <NodeRow key={n.nodeId} n={n} />)}
          </div>
        )}
      </div>

      {/* Totals footer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-3/30 px-3 py-2 text-[11px] text-fg-muted">
        <span><b className="text-fg">{formatNumber(data.totals.tokens)}</b> tokens (in {formatNumber(data.totals.inputTokens)} · out {formatNumber(data.totals.outputTokens)})</span>
        <span>·</span>
        <span>current config: <b className="text-fg">{money(data.current.costUsd)}</b> · {latency(data.current.latencyMs)}</span>
        {data.current.note && <span className="text-amber-400">· {data.current.note}</span>}
      </div>
    </div>
  );
}

function RecCard({ title, icon, rec }: { title: string; icon: string; rec: Recommendation | null }) {
  if (!rec) {
    return (
      <div className="rounded-lg border border-dashed border-border px-2.5 py-2">
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle"><Icon name={icon} className="h-3 w-3" /> {title}</div>
        <div className="mt-1 text-xs text-fg-subtle">Unknown</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-surface-3/50 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle"><Icon name={icon} className="h-3 w-3" /> {title}</div>
      <div className="mt-1 text-xs font-semibold">{rec.providerLabel}</div>
      <div className="text-[10px] text-fg-muted">{rec.modelLabel}</div>
      <div className="mt-1 text-sm font-semibold text-fg">{money(rec.costUsd)}</div>
      <div className="text-[10px] text-fg-subtle">{latency(rec.latencyMs)}</div>
    </div>
  );
}

function ProviderCard({ e, isRec }: { e: ProviderEstimate; isRec: boolean }) {
  const avBadge =
    e.available === true ? { text: "configured", cls: "bg-success/15 text-success" }
      : e.available === false ? { text: "not configured", cls: "bg-danger/15 text-danger" }
        : { text: "unknown", cls: "bg-fg-subtle/15 text-fg-subtle" };
  return (
    <div className={cn("rounded-lg border px-3 py-2", isRec ? "border-brand/40 bg-brand-soft/20" : "border-border bg-surface-3/30")}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: e.accent }} />
        <span className="text-xs font-semibold">{e.providerLabel}</span>
        <span className="text-[10px] text-fg-muted">· {e.modelLabel}</span>
        <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[9px] font-medium", avBadge.cls)}>{avBadge.text}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-4 gap-1 text-center">
        <Metric label="Cost" value={money(e.costUsd)} />
        <Metric label="Latency" value={latency(e.latencyMs)} />
        <Metric label="Tokens" value={formatNumber(e.tokens)} />
        <Metric label="Confidence" value={confPct(e.confidence)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-surface-2/60 px-1 py-1">
      <div className="text-[9px] uppercase tracking-wider text-fg-subtle">{label}</div>
      <div className="text-[11px] font-semibold text-fg">{value}</div>
    </div>
  );
}

function NodeRow({ n }: { n: NodeEstimate }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-3/20 px-2 py-1.5 text-[11px]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: providerAccent(n.providerId) }} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{n.label}</span>
        <span className="ml-1.5 text-fg-subtle">{n.providerLabel} · {n.model}</span>
        {!n.modelKnown && <span className="ml-1.5 rounded bg-amber-500/15 px-1 text-[9px] text-amber-400">unknown model</span>}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-fg-muted">{formatNumber(n.tokens)}t</span>
      <span className="shrink-0 text-fg-muted">{latency(n.latencyMs)}</span>
      <span className="shrink-0 font-semibold text-fg">{money(n.costUsd)}</span>
    </div>
  );
}

function providerAccent(id: string): string {
  switch (id) {
    case "openai": return "#10a37f";
    case "anthropic": return "#d97706";
    case "gemini": return "#4285f4";
    default: return "#64748b";
  }
}