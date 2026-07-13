"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn, formatDuration } from "@/lib/utils";

export type DockStatus = "idle" | "running" | "paused" | "succeeded" | "failed" | "cancelled";

export interface DockStep {
  nodeId: string;
  nodeName: string;
  status: "running" | "succeeded" | "failed" | "retrying" | "skipped";
  durationMs: number;
  tokensUsed: number;
  cost: number;
  retries: number;
  error?: string;
  logs: string[];
}

export function ExecutionDock({
  open,
  onToggle,
  status,
  log,
  steps,
  onRun,
  onPause,
  onResume,
  onStop,
  onRetryNode,
  onDiagnose,
}: {
  open: boolean;
  onToggle: () => void;
  status: DockStatus;
  log: string[];
  steps: DockStep[];
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetryNode: (nodeId: string) => void;
  onDiagnose: (nodeId: string) => void;
}) {
  const [tab, setTab] = useState<"timeline" | "log" | "errors">("timeline");
  const succeeded = steps.filter((s) => s.status === "succeeded").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const failedSteps = steps.filter((s) => s.status === "failed");

  return (
    <div className="pointer-events-auto w-full rounded-t-xl border border-b-0 border-border bg-bg/95 backdrop-blur-xl shadow-2xl">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <button onClick={onToggle} className="grid h-6 w-6 place-items-center rounded-md hover:bg-surface-2 text-fg-muted">
          <Icon name={open ? "ChevronDown" : "ChevronUp"} className="h-3.5 w-3.5" />
        </button>
        <Icon name="Terminal" className="h-3.5 w-3.5 text-fg-subtle" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">Execution</span>
        <StatusPill status={status} />
        {status === "running" && <span className="flex items-center gap-1 text-[10px] text-brand"><Icon name="LoaderCircle" className="h-3 w-3 animate-spin" /> live</span>}
        {status !== "running" && steps.length > 0 && (
          <span className="text-[10px] text-fg-subtle">{succeeded} ok · {failed} failed</span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {status === "running" ? (
            <Button variant="danger" size="sm" onClick={onStop}><Icon name="Square" className="h-3 w-3" /> Stop</Button>
          ) : status === "paused" ? (
            <>
              <Button variant="ai" size="sm" onClick={onResume}><Icon name="Play" className="h-3 w-3" /> Resume</Button>
              <Button variant="danger" size="sm" onClick={onStop}><Icon name="Square" className="h-3 w-3" /> Stop</Button>
            </>
          ) : (
            <Button variant="ai" size="sm" onClick={onRun}><Icon name="Play" className="h-3 w-3" /> Run</Button>
          )}
        </div>
      </div>

      {open && (
        <div className="flex h-48 flex-col">
          <div className="flex gap-1 border-b border-border px-2 py-1">
            {([["timeline", "Timeline"], ["log", "Log"], ["errors", `Errors${failed ? ` (${failed})` : ""}`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={cn("rounded-md px-2.5 py-1 text-[11px]", tab === k ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg")}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "timeline" && (
              <div className="p-2 space-y-1.5">
                {steps.length === 0 && <div className="px-2 py-3 text-[11px] text-fg-subtle">Run the workflow to see the step timeline.</div>}
                {steps.map((s) => <StepCard key={s.nodeId} step={s} onRetry={onRetryNode} onDiagnose={onDiagnose} />)}
              </div>
            )}

            {tab === "log" && (
              <div className="p-2 font-mono text-[10px] leading-relaxed">
                {log.length === 0 ? <div className="px-2 py-3 text-fg-subtle">Press Run to execute. Logs stream in real time.</div> : log.slice(-80).map((l, i) => (
                  <div key={i} className={cn("py-0.5", l.startsWith("✓") && "text-success", l.startsWith("›") && "text-fg-muted", l.includes("error") && "text-danger")}>{l}</div>
                ))}
              </div>
            )}

            {tab === "errors" && (
              <div className="p-2 space-y-2">
                {failedSteps.length === 0 ? (
                  <div className="px-2 py-3 text-[11px] text-fg-subtle">No failed nodes in this run.</div>
                ) : failedSteps.map((s) => (
                  <div key={s.nodeId} className="rounded-lg border border-danger/30 bg-danger/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-danger">
                      <Icon name="XCircle" className="h-3.5 w-3.5" /> {s.nodeName}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-fg-muted">{s.error ?? s.logs.slice(-1)[0] ?? "failed"}</div>
                    <div className="mt-2 flex gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => onRetryNode(s.nodeId)}><Icon name="RotateCcw" className="h-3 w-3" /> Retry</Button>
                      <Button variant="secondary" size="sm" onClick={() => onDiagnose(s.nodeId)}><Icon name="Stethoscope" className="h-3 w-3" /> Diagnose</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: DockStatus }) {
  const map: Record<DockStatus, { c: string; label: string }> = {
    idle: { c: "bg-surface-3 text-fg-muted", label: "idle" },
    running: { c: "bg-brand/20 text-brand", label: "running" },
    paused: { c: "bg-warning/20 text-warning", label: "paused" },
    succeeded: { c: "bg-success/20 text-success", label: "succeeded" },
    failed: { c: "bg-danger/20 text-danger", label: "failed" },
    cancelled: { c: "bg-surface-3 text-fg-muted", label: "cancelled" },
  };
  const m = map[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", m.c)}>{m.label}</span>;
}

function StepCard({ step, onRetry, onDiagnose }: { step: DockStep; onRetry: (id: string) => void; onDiagnose: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const dot: Record<DockStep["status"], string> = {
    running: "bg-brand", succeeded: "bg-success", failed: "bg-danger", retrying: "bg-warning", skipped: "bg-fg-subtle",
  };
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-2">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-center gap-2 text-left">
        <span className={cn("h-2 w-2 rounded-full", dot[step.status], step.status === "running" && "animate-pulse")} />
        <span className="flex-1 truncate text-[11px] font-medium">{step.nodeName}</span>
        {step.status === "running" && <Icon name="LoaderCircle" className="h-3 w-3 animate-spin text-brand" />}
        {step.status === "succeeded" && <Icon name="CheckCircle2" className="h-3 w-3 text-success" />}
        {step.status === "failed" && <Icon name="XCircle" className="h-3 w-3 text-danger" />}
        <span className="tabular-nums text-[10px] text-fg-subtle">{formatDuration(step.durationMs)}</span>
        {step.tokensUsed > 0 && <span className="text-[10px] text-fg-subtle">{step.tokensUsed}t</span>}
        {step.retries > 0 && <span className="text-[10px] text-warning">↻{step.retries}</span>}
        <Icon name={expanded ? "ChevronDown" : "ChevronRight"} className="h-3 w-3 text-fg-subtle" />
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          {step.logs.length > 0 && (
            <div className="rounded-md border border-border bg-bg/60 p-1.5 font-mono text-[9px] leading-relaxed text-fg-muted">
              {step.logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
          {step.status === "failed" && (
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => onRetry(step.nodeId)}><Icon name="RotateCcw" className="h-2.5 w-2.5" /> Retry</Button>
              <Button variant="secondary" size="sm" onClick={() => onDiagnose(step.nodeId)}><Icon name="Stethoscope" className="h-2.5 w-2.5" /> Diagnose</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}