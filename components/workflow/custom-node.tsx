"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "@/components/ui/icon";
import { getNodeDef } from "@/lib/nodes";
import { cn, formatDuration } from "@/lib/utils";
import type { NodeStatus } from "@/lib/types";

const statusRing: Record<NodeStatus, string> = {
  idle: "border-border",
  running: "border-brand shadow-[0_0_0_2px_rgba(124,92,255,0.4),0_8px_30px_-8px_rgba(124,92,255,0.6)]",
  succeeded: "border-success/50",
  failed: "border-danger/60 shadow-[0_0_0_2px_rgba(251,113,133,0.35)]",
  retrying: "border-warning/60 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]",
  skipped: "border-border opacity-50",
};

const statusColor: Record<NodeStatus, string> = {
  idle: "#6b7185",
  running: "#7c5cff",
  succeeded: "#34d399",
  failed: "#fb7185",
  retrying: "#fbbf24",
  skipped: "#6b7185",
};

function WorkflowNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as { label: string; config: Record<string, unknown>; status?: NodeStatus; durationMs?: number; logs?: string[]; retries?: number; type?: string };
  // type is passed via parent through node data isn't standard; we store type on the node object.
  // We read it from a custom field we attach.
  const type = (d as unknown as { __type?: string }).__type ?? (d.config?.__type as string) ?? "util.delay";
  const def = getNodeDef(type) ?? getNodeDef("util.transform")!;
  const status: NodeStatus = d.status ?? "idle";
  const color = def.color;

  return (
    <div
      className={cn(
        "w-52 rounded-xl border bg-surface/90 backdrop-blur-xl transition-all",
        statusRing[status],
        selected && "border-brand"
      )}
    >
      {/* target handle */}
      {def.inputs > 0 && (
        <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-fg-subtle" />
      )}

      {/* header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${color}22`, color }}>
          <Icon name={def.icon} className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{d.label}</div>
          <div className="text-[10px] text-fg-subtle">{def.category}</div>
        </div>
        {status === "running" && (
          <Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin text-brand" />
        )}
        {status === "succeeded" && <Icon name="CheckCircle2" className="h-3.5 w-3.5 text-success" />}
        {status === "failed" && <Icon name="XCircle" className="h-3.5 w-3.5 text-danger" />}
        {status === "retrying" && <Icon name="RefreshCw" className="h-3.5 w-3.5 animate-spin text-warning" />}
      </div>

      {/* status bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px]">
        <span className="dot" style={{ background: statusColor[status] }} />
        <span className="capitalize text-fg-muted">{status}</span>
        {d.durationMs !== undefined && status !== "idle" && (
          <span className="ml-auto tabular-nums text-fg-subtle">{formatDuration(d.durationMs)}</span>
        )}
        {d.retries ? <span className="ml-auto text-warning">↻{d.retries}</span> : null}
      </div>

      {/* last log */}
      {d.logs && d.logs.length > 0 && (
        <div className="border-t border-border px-3 py-1.5 font-mono text-[10px] text-fg-subtle truncate">
          <Icon name="Terminal" className="mr-1 inline h-2.5 w-2.5" />
          {d.logs[d.logs.length - 1]}
        </div>
      )}

      {/* source handle(s) */}
      {def.outputs > 0 && (
        <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0" style={{ background: color }} />
      )}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);