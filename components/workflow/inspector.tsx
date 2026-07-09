"use client";

import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNodeDef } from "@/lib/nodes";
import { cn, formatDuration } from "@/lib/utils";
import type { WorkflowNode } from "@/lib/types";

export function Inspector({
  node,
  onRename,
  onRetry,
}: {
  node: WorkflowNode | null;
  onRename: (id: string, label: string) => void;
  onRetry: (id: string) => void;
}) {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-fg-subtle">
          <Icon name="MousePointerClick" className="h-5 w-5" />
        </div>
        <div className="mt-3 text-sm font-medium">Select a node</div>
        <p className="mt-1 text-xs text-fg-muted">Click any node on the canvas to inspect its settings, logs, and execution details.</p>
      </div>
    );
  }

  const def = getNodeDef(node.type)!;
  const status = node.data.status ?? "idle";
  const tone = status === "succeeded" ? "success" : status === "failed" ? "danger" : status === "running" ? "brand" : status === "retrying" ? "warning" : "neutral";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-border p-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${def.color}22`, color: def.color }}>
          <Icon name={def.icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{node.data.label}</div>
          <div className="text-[10px] text-fg-subtle">{node.type}</div>
        </div>
        <Badge tone={tone as any}>{status}</Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Execution metrics */}
        <Section icon="Activity" title="Execution">
          <Row label="Status" value={<span className="capitalize">{status}</span>} />
          <Row label="Duration" value={node.data.durationMs !== undefined ? formatDuration(node.data.durationMs) : "—"} />
          <Row label="Retries" value={`${node.data.retries ?? 0}`} />
          <Row label="Inputs" value={`${def.inputs}`} />
          <Row label="Outputs" value={`${def.outputs}`} />
        </Section>

        {/* Settings */}
        <Section icon="Settings2" title="Settings">
          <label className="block">
            <span className="mb-1 block text-[11px] text-fg-muted">Label</span>
            <input
              value={node.data.label}
              onChange={(e) => onRename(node.id, e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-fg focus-ring"
            />
          </label>
          {Object.keys(node.data.config).filter((k) => k !== "__type").length === 0 ? (
            <p className="text-[11px] text-fg-subtle">This node has no configurable settings.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(node.data.config).filter(([k]) => k !== "__type").map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider text-fg-subtle">{k}</div>
                  <div className="mt-0.5 truncate rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-mono">
                    {String(v)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Logs */}
        <Section icon="Terminal" title="Logs">
          {(!node.data.logs || node.data.logs.length === 0) ? (
            <p className="text-[11px] text-fg-subtle">No logs yet. Run the workflow to see live output.</p>
          ) : (
            <div className="rounded-lg border border-border bg-bg/60 p-2 font-mono text-[10px] leading-relaxed max-h-44 overflow-y-auto">
              {node.data.logs.map((log, i) => (
                <div key={i} className={cn("py-0.5", i === node.data.logs!.length - 1 && status === "running" && "text-brand")}>
                  <span className="text-fg-subtle">{String(i + 1).padStart(2, "0")} </span>
                  <span className="text-fg-muted">{log}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full" onClick={() => onRetry(node.id)} disabled={status === "idle"}>
          <Icon name="RotateCcw" className="h-3.5 w-3.5" /> Retry node
        </Button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
        <Icon name={icon} className="h-3 w-3" /> {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-2.5 py-1.5">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}