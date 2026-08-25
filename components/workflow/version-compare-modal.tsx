"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn, relativeTime } from "@/lib/utils";
import type { GraphDiff, ConfigChange } from "@/lib/workflow/diff";
import type { Graph } from "@/lib/workflow/graph";
import type { VersionEntry } from "@/components/workflow/version-history";

export interface CompareVersionMeta {
  version: number;
  message: string | null;
  author: string | null;
  createdAt: string;
  graph: Graph;
}

interface CompareData {
  from: CompareVersionMeta;
  to: CompareVersionMeta;
  diff: GraphDiff;
}

function fmt(v: unknown): string {
  if (v === undefined) return "∅";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
function trunc(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function fieldTag(f: string): string {
  if (f === "position") return "moved";
  if (f === "label") return "renamed";
  if (f === "type") return "type";
  return f;
}

export function VersionCompareModal({
  workflowId,
  versions,
  initialFrom,
  initialTo,
  onClose,
}: {
  workflowId: string;
  versions: VersionEntry[];
  initialFrom?: number;
  initialTo?: number;
  onClose: () => void;
}) {
  const sortedDesc = useMemo(() => [...versions].sort((a, b) => b.version - a.version), [versions]);
  const [fromV, setFromV] = useState<number>(initialFrom ?? sortedDesc[1]?.version ?? sortedDesc[0]?.version ?? 0);
  const [toV, setToV] = useState<number>(initialTo ?? sortedDesc[0]?.version ?? 0);
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // Fetch the comparison when the selected versions change; the leading
    // setData(null) clears stale results before the async load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!fromV || !toV || fromV === toV) { setData(null); return; }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/workflows/${workflowId}/versions/compare?from=${fromV}&to=${toV}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : r.json().then((b) => Promise.reject(b))))
      .then((d: CompareData) => setData(d))
      .catch((e) => { if (e?.name !== "AbortError") setError(e?.error ?? "Failed to load comparison."); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [workflowId, fromV, toV]);

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const fromMeta = versions.find((v) => v.version === fromV);
  const toMeta = versions.find((v) => v.version === toV);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative flex h-[85vh] w-[min(64rem,95vw)] flex-col overflow-hidden rounded-2xl border border-border bg-surface-2/95 backdrop-blur-2xl shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="GitCompare" className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold">Compare versions</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg">
            <Icon name="X" className="h-4 w-4" />
          </button>
        </div>

        {/* Version pickers + side-by-side meta */}
        <div className="border-b border-border px-4 py-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <VersionPicker label="From" value={fromV} onChange={setFromV} versions={sortedDesc} tone="from" />
            <Icon name="ArrowRight" className="h-4 w-4 text-fg-subtle" />
            <VersionPicker label="To" value={toV} onChange={setToV} versions={sortedDesc} tone="to" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <VersionCard v={fromMeta} tone="from" />
            <VersionCard v={toMeta} tone="to" />
          </div>
        </div>

        {/* Diff body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}
          {loading && (
            <div className="flex items-center gap-2 px-1 py-6 text-xs text-fg-subtle">
              <Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Computing diff…
            </div>
          )}
          {!loading && !error && data && <DiffView diff={data.diff} expanded={expanded} toggle={toggle} />}
          {!loading && !error && !data && (fromV === toV || !fromV || !toV) && (
            <div className="px-1 py-6 text-center text-xs text-fg-subtle">Select two different versions to compare.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function VersionPicker({ label, value, onChange, versions, tone }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  versions: VersionEntry[];
  tone: "from" | "to";
}) {
  return (
    <label className="block">
      <span className={cn("mb-1 block text-[10px] font-semibold uppercase tracking-widest", tone === "from" ? "text-danger/80" : "text-success/80")}>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-full appearance-none rounded-lg border border-border bg-surface-3 px-3 pr-8 text-xs font-medium text-fg focus:border-brand focus:outline-none"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.version}>v{v.version} · {v.message ?? "Untitled version"}</option>
          ))}
        </select>
        <Icon name="ChevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
      </div>
    </label>
  );
}

function VersionCard({ v, tone }: { v: VersionEntry | undefined; tone: "from" | "to" }) {
  if (!v) return <div className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-fg-subtle">—</div>;
  const dot = tone === "from" ? "bg-danger" : "bg-success";
  return (
    <div className="rounded-lg border border-border bg-surface-3/60 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        <span className="text-xs font-semibold">v{v.version}</span>
        {v.message && <span className="truncate text-[11px] text-fg-muted">· {v.message}</span>}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-fg-subtle">
        <span className="inline-flex items-center gap-1"><Icon name="User" className="h-3 w-3" />{v.author ?? "unknown"}</span>
        <span className="inline-flex items-center gap-1"><Icon name="Clock" className="h-3 w-3" />{relativeTime(v.createdAt)}</span>
      </div>
    </div>
  );
}

function DiffView({ diff, expanded, toggle }: { diff: GraphDiff; expanded: Set<string>; toggle: (id: string) => void }) {
  if (diff.identical) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-fg-subtle">
        <Icon name="Check" className="h-6 w-6 text-success" />
        <p className="text-xs">These versions are identical — no structural changes.</p>
      </div>
    );
  }

  const changedNodes = diff.nodes.filter((n) => n.kind === "changed");
  const addedNodes = diff.nodes.filter((n) => n.kind === "added");
  const removedNodes = diff.nodes.filter((n) => n.kind === "removed");

  return (
    <div className="space-y-4">
      {/* Summary line */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-3/40 px-3 py-2">
        <Icon name="Diff" className="h-3.5 w-3.5 text-brand" />
        <span className="text-xs font-medium">{diff.summary}</span>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          {diff.counts.added > 0 && <span className="text-success">+{diff.counts.added} added</span>}
          {diff.counts.removed > 0 && <span className="text-danger">−{diff.counts.removed} removed</span>}
          {diff.counts.changed > 0 && <span className="text-amber">~{diff.counts.changed} changed</span>}
          {diff.counts.edgesAdded > 0 && <span className="text-success">+{diff.counts.edgesAdded} edges</span>}
          {diff.counts.edgesRemoved > 0 && <span className="text-danger">−{diff.counts.edgesRemoved} edges</span>}
        </div>
      </div>

      {/* Node changes */}
      <Section title="Nodes" count={diff.nodes.length}>
        <div className="space-y-1">
          {[...addedNodes, ...removedNodes, ...changedNodes].map((n) => (
            <NodeDiffRow key={`${n.kind}-${n.id}`} n={n} expanded={expanded} toggle={toggle} />
          ))}
        </div>
      </Section>

      {/* Edge changes */}
      {diff.edges.length > 0 && (
        <Section title="Connections" count={diff.edges.length}>
          <div className="space-y-1">
            {diff.edges.map((e) => (
              <div key={`${e.kind}-${e.id}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px]">
                <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] font-bold", e.kind === "added" ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
                  {e.kind === "added" ? "+" : "−"}
                </span>
                <span className="font-mono text-fg-muted">{e.source} → {e.target}</span>
                {e.label && <span className="text-fg-subtle">({e.label})</span>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
        {title} <span className="rounded bg-surface-3 px-1 text-[9px] text-fg-muted">{count}</span>
      </div>
      {children}
    </div>
  );
}

function NodeDiffRow({ n, expanded, toggle }: { n: import("@/lib/workflow/diff").NodeChange; expanded: Set<string>; toggle: (id: string) => void }) {
  const tone =
    n.kind === "added" ? { badge: "bg-success/15 text-success", sym: "+" }
      : n.kind === "removed" ? { badge: "bg-danger/15 text-danger", sym: "−" }
        : { badge: "bg-amber-500/15 text-amber-400", sym: "~" };
  const hasConfig = n.config.length > 0;
  const open = expanded.has(n.id);

  return (
    <div className="rounded-md border border-border bg-surface-3/30">
      <button
        onClick={() => hasConfig && toggle(n.id)}
        className={cn("flex w-full items-center gap-2 px-2 py-1.5 text-left", hasConfig && "cursor-pointer hover:bg-surface-3/60")}
      >
        <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] font-bold", tone.badge)}>{tone.sym}</span>
        <span className="min-w-0 flex-1">
          <span className="truncate text-xs font-medium">{n.label || "(unnamed)"}</span>
          <span className="ml-1.5 text-[10px] text-fg-subtle">{n.type}</span>
        </span>
        {n.kind === "changed" && (
          <span className="flex flex-wrap items-center justify-end gap-1">
            {n.fields.map((f) => (
              <span key={f} className="rounded bg-surface-3 px-1 py-0.5 text-[9px] text-fg-muted">{fieldTag(f)}</span>
            ))}
          </span>
        )}
        {hasConfig && <Icon name="ChevronRight" className={cn("h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform", open && "rotate-90")} />}
      </button>
      {hasConfig && open && (
        <div className="border-t border-border px-2 py-1.5">
          <ConfigDiffList changes={n.config} />
        </div>
      )}
    </div>
  );
}

function ConfigDiffList({ changes }: { changes: ConfigChange[] }) {
  return (
    <div className="space-y-1">
      {changes.map((c) => (
        <div key={c.key} className="rounded bg-surface-2/60 px-2 py-1">
          <div className="text-[10px] font-semibold text-fg-muted">{c.key}</div>
          <div className="mt-0.5 grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5 font-mono text-[10px]">
            <span className="text-danger/80">−</span>
            <span className="break-all text-danger/80 line-through opacity-70">{trunc(fmt(c.from))}</span>
            <span className="text-success">+</span>
            <span className="break-all text-success">{trunc(fmt(c.to))}</span>
          </div>
        </div>
      ))}
    </div>
  );
}