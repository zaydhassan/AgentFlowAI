"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, relativeTime } from "@/lib/utils";
import type { Graph } from "@/lib/workflow/graph";

export interface VersionEntry {
  id: string;
  version: number;
  message: string | null;
  author: string | null;
  createdAt: string;
}

export function VersionHistory({
  workflowId,
  versions,
  currentVersion,
  onRestored,
  onSaved,
  onCompare,
}: {
  workflowId: string;
  versions: VersionEntry[];
  currentVersion: number;
  onRestored: (graph: Graph, head: VersionEntry) => void;
  onSaved?: (v: VersionEntry) => void;
  onCompare?: (from?: number, to?: number) => void;
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const save = () => {
    setSaving(true);
    fetch(`/api/workflows/${workflowId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim() || undefined }),
    })
      .then((r) => r.json())
      .then((v: VersionEntry) => {
        setMessage("");
        if (v?.version) onSaved?.(v);
      })
      .catch(() => setSaving(false))
      .finally(() => setSaving(false));
  };

  const restore = (v: number) => {
    setBusy(v);
    fetch(`/api/workflows/${workflowId}/versions/${v}?action=restore`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.graph && d.version) onRestored(d.graph, d.version);
        setBusy(null);
      })
      .catch(() => setBusy(null));
  };

  return (
    <div className="w-80 rounded-xl border border-border bg-surface-2/95 backdrop-blur-xl shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">Version history · v{currentVersion}</span>
        {onCompare && versions.length >= 2 && (
          <button
            onClick={() => onCompare()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-muted hover:text-fg hover:border-brand/40"
            title="Compare two versions"
          >
            <Icon name="GitCompare" className="h-3 w-3" /> Compare
          </button>
        )}
      </div>
      <div className="p-2.5 space-y-2">
        <div className="flex gap-1.5">
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Save current as version…" className="h-8 text-xs" />
          <Button size="sm" className="h-8 shrink-0" disabled={saving} onClick={save} title="Save version (⌘S)">
            {saving ? <Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> : <Icon name="Save" className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto px-2 pb-2 space-y-1">
        {versions.length === 0 && <div className="px-2 py-3 text-center text-[11px] text-fg-subtle">No saved versions yet.</div>}
        {versions.map((v) => {
          const isHead = v.version === currentVersion;
          return (
            <div key={v.id} className={cn("flex items-center gap-2 rounded-lg border px-2 py-1.5", isHead ? "border-brand/30 bg-brand-soft/40" : "border-border bg-surface-2/40")}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface-3 text-[10px] font-semibold text-fg-muted">v{v.version}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium">{v.message ?? "Untitled version"}</div>
                <div className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
                  {v.author && <span className="inline-flex items-center gap-0.5 truncate"><Icon name="User" className="h-2.5 w-2.5 shrink-0" />{v.author}</span>}
                  <span className="shrink-0" title={new Date(v.createdAt).toLocaleString()}>{relativeTime(v.createdAt)}</span>
                </div>
              </div>
              {!isHead && (
                <button
                  onClick={() => restore(v.version)}
                  disabled={busy !== null}
                  className="shrink-0 rounded-md border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-muted hover:text-fg hover:border-brand/40 disabled:opacity-50"
                  title="Restore this version (creates a new head, reversible)"
                >
                  {busy === v.version ? <Icon name="LoaderCircle" className="h-3 w-3 animate-spin" /> : "Restore"}
                </button>
              )}
              {isHead && <span className="shrink-0 rounded bg-brand/15 px-1 py-0.5 text-[9px] font-semibold text-brand">HEAD</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}