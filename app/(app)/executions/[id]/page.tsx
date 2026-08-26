"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useExecution } from "@/lib/executions/use-execution";
import { cn, formatDuration, formatCurrency, relativeTime } from "@/lib/utils";
import type { ExecutionStepRow, MemoryHit } from "@/lib/executions/types";

const statusMeta: Record<string, { tone: Tone; icon: string; color: string }> = {
  idle: { tone: "neutral", icon: "Circle", color: "#6b7185" },
  running: { tone: "brand", icon: "LoaderCircle", color: "#7c5cff" },
  succeeded: { tone: "success", icon: "CheckCircle2", color: "#34d399" },
  failed: { tone: "danger", icon: "XCircle", color: "#fb7185" },
  retrying: { tone: "warning", icon: "RefreshCw", color: "#fbbf24" },
  skipped: { tone: "neutral", icon: "SkipForward", color: "#6b7185" },
  paused: { tone: "neutral", icon: "Pause", color: "#6b7185" },
};

// Cap rendered logs per step to bound render cost on chatty nodes.
const MAX_LOGS = 200;

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { detail, steps, live, loading, error, refresh } = useExecution(id);

  const running = detail?.status === "running";
  const status = live?.status ?? detail?.status ?? "running";

  // Staged-reveal state for the "Replay run" playback on finished runs.
  const [replaying, setReplaying] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(steps.length);
  const [visibleLogs, setVisibleLogs] = useState<Record<string, number>>({});

  // Reset reveal to "everything shown" whenever the step set changes (live
  // updates while running, or a fresh snapshot). Replay re-animates from there.
  useEffect(() => {
    if (replaying) return; // don't clobber an in-progress playback.
    // Re-sync the reveal counters to the latest step set (live updates while a
    // run is in flight, or a fresh snapshot). Steps come from the data hook, so
    // this effect is the sync point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleSteps(steps.length);
    const init: Record<string, number> = {};
    for (const s of steps) init[s.id] = Math.min(s.logs.length, MAX_LOGS);
    setVisibleLogs(init);
  }, [steps, replaying]);

  const replay = () => {
    if (replaying || running) return;
    setReplaying(true);
    setVisibleSteps(0);
    setVisibleLogs({});
    steps.forEach((step, i) => {
      const show = Math.min(step.logs.length, MAX_LOGS);
      setTimeout(() => setVisibleSteps(i + 1), 400 * (i + 1));
      step.logs.slice(0, show).forEach((_, j) => {
        setTimeout(
          () => setVisibleLogs((p) => ({ ...p, [step.id]: (p[step.id] ?? 0) + 1 })),
          400 * (i + 1) + 250 * (j + 1),
        );
      });
    });
    const last = steps[steps.length - 1];
    const tail = last ? 400 * steps.length + Math.min(last.logs.length, MAX_LOGS) * 250 + 1200 : 400 * steps.length;
    setTimeout(() => setReplaying(false), tail);
  };

  if (loading && !detail) {
    return (
      <div className="animate-float-up">
        <BackLink />
        <PageHeader title="Execution" description="Loading run…" />
        <Card>
          <div className="py-16">
            <EmptyState icon="Activity" title="Loading execution…" description="Fetching run, steps, and inspection payload." />
          </div>
        </Card>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="animate-float-up">
        <BackLink />
        <PageHeader title="Execution" description="Couldn’t load this run." />
        <Card>
          <div className="py-16">
            <EmptyState icon="AlertTriangle" title="Couldn’t load execution" description={error} ctaLabel="Retry" onCta={() => refresh()} />
          </div>
        </Card>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="animate-float-up">
        <BackLink />
        <PageHeader title="Execution not found" description="This run may have been deleted, or you don’t have access to it." />
        <Card>
          <div className="py-16">
            <EmptyState
              icon="SearchX"
              title="Execution not found"
              description="It may have been deleted or belong to another account."
              ctaLabel="Back to executions"
              onCta={() => (window.location.href = "/executions")}
            />
          </div>
        </Card>
      </div>
    );
  }

  const totals = live?.totals;
  const durationMs = totals?.durationMs ?? detail.durationMs;
  const totalCost = totals?.totalCost ?? detail.totalCost;
  const totalTokens = totals?.totalTokens ?? detail.totalTokens;
  const retried = totals?.retried ?? detail.retried;

  const shownSteps = running ? steps : steps.slice(0, visibleSteps);

  return (
    <div className="animate-float-up">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href="/executions" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-surface-2">
            <Icon name="ArrowLeft" className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="min-w-0 truncate text-xl font-semibold">{detail.workflowName}</h1>
              <Badge tone={toneOf(status)} className="shrink-0">
                {running && <Icon name="LoaderCircle" className="mr-1 h-2.5 w-2.5 animate-spin" />}
                {status}
              </Badge>
            </div>
            <div className="truncate font-mono text-[11px] text-fg-subtle">{detail.id} · {relativeTime(detail.startedAt)}</div>
          </div>
        </div>
        <Button variant="ai" size="sm" onClick={replay} disabled={replaying || running || steps.length === 0} className="shrink-0">
          {replaying ? <><Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> <span className="hidden sm:inline">Replaying…</span></> : <><Icon name="Play" className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Replay run</span></>}
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon="Clock" label="Duration" value={durationMs ? formatDuration(durationMs) : running ? "—" : "—"} />
        <MetricCard icon="Coins" label="Cost" value={totalCost ? formatCurrency(totalCost) : "—"} />
        <MetricCard icon="Cpu" label="Tokens" value={totalTokens ? totalTokens.toLocaleString("en-US") : "—"} />
        <MetricCard icon="RefreshCw" label="Retries" value={`${retried}`} />
      </div>

      {detail.error && (
        <Card className="mb-4 border-danger/40 bg-danger/5 p-4">
          <div className="flex items-start gap-2 text-sm">
            <Icon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div>
              <div className="font-medium text-danger">Run failed</div>
              <div className="mt-1 font-mono text-xs text-fg-muted">{detail.error}</div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Icon name="ListTree" className="h-4 w-4 text-brand" /> Execution Timeline
          {running && <Badge tone="brand" className="ml-1"><span className="dot dot-live bg-brand mr-1.5" /> live</Badge>}
        </div>
        <div className="relative">
          <div className="absolute bottom-2 left-[19px] top-2 w-px bg-border" />
          <div className="space-y-1">
            {shownSteps.length === 0 ? (
              <div className="relative pl-12 py-2 text-sm text-fg-subtle">
                <span className="absolute left-2 top-3 grid h-9 w-9 place-items-center rounded-full border-2 border-border bg-bg">
                  <Icon name="LoaderCircle" className="h-4 w-4 animate-spin text-fg-subtle" />
                </span>
                {running ? "awaiting first step…" : "No steps recorded."}
              </div>
            ) : (
              shownSteps.map((step) => (
                <StepRow
                  key={step.id}
                  step={step}
                  workflowId={detail.workflowId}
                  executionId={detail.id}
                  running={running}
                  logsShown={running ? Math.min(step.logs.length, MAX_LOGS) : visibleLogs[step.id] ?? Math.min(step.logs.length, MAX_LOGS)}
                />
              ))
            )}
            {!running && visibleSteps < steps.length && (
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

function BackLink() {
  return (
    <div className="mb-4">
      <Link href="/executions" className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
        <Icon name="ArrowLeft" className="h-3.5 w-3.5" /> Back to executions
      </Link>
    </div>
  );
}

function toneOf(s: string): Tone {
  return s === "succeeded" ? "success" : s === "failed" ? "danger" : s === "running" ? "brand" : s === "retrying" ? "warning" : "neutral";
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

function StepRow({
  step,
  workflowId,
  executionId,
  running,
  logsShown,
}: {
  step: ExecutionStepRow;
  workflowId: string;
  executionId: string;
  running: boolean;
  logsShown: number;
}) {
  const m = statusMeta[step.status] ?? statusMeta.idle;
  const hasInspect =
    !!step.nodeType ||
    step.config != null ||
    step.input != null ||
    step.output != null ||
    step.prompt != null ||
    (step.memories != null && step.memories.length > 0);

  return (
    <div className="relative pl-12 py-2 animate-float-up">
      <span
        className="absolute left-2 top-3 grid h-9 w-9 place-items-center rounded-full border-2 bg-bg"
        style={{ borderColor: m.color, color: m.color }}
      >
        <Icon
          name={m.icon}
          className={cn("h-4 w-4", step.status === "running" && "animate-spin", step.status === "retrying" && "animate-spin")}
        />
      </span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 truncate text-sm font-medium">{step.nodeName}</span>
        <Badge tone={m.tone} className="shrink-0">{step.status}</Badge>
        {step.nodeType && (
          <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">{step.nodeType}</span>
        )}
        <span className="text-[11px] text-fg-subtle">{formatDuration(step.durationMs)}</span>
        {step.retries > 0 && <span className="text-[11px] text-warning">↻ {step.retries}</span>}
        {step.cost != null && <span className="ml-auto text-[11px] text-fg-muted">{formatCurrency(step.cost)}</span>}
      </div>

      {step.error && (
        <div className="mt-2 rounded-lg border border-danger/30 bg-danger/5 p-2 font-mono text-[11px] text-danger">{step.error}</div>
      )}

      {step.reasoning && step.reasoning.length > 0 && (
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

      {step.logs.length > 0 && (
        <div className="mt-2 rounded-lg border border-border bg-bg/60 p-2 font-mono text-[10px] leading-relaxed">
          {step.logs.slice(0, logsShown).map((log, li) => (
            <div key={li} className="py-0.5 animate-float-up">
              <span className="text-fg-subtle">{String(li + 1).padStart(2, "0")} </span>
              <span className="text-fg-muted">{log}</span>
            </div>
          ))}
          {!running && logsShown < step.logs.length && <div className="text-brand">▋</div>}
        </div>
      )}

      {hasInspect && <InspectSection step={step} workflowId={workflowId} executionId={executionId} />}
    </div>
  );
}

function InspectSection({
  step,
  workflowId,
  executionId,
}: {
  step: ExecutionStepRow;
  workflowId: string;
  executionId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted hover:text-fg"
      >
        <Icon name={open ? "ChevronDown" : "ChevronRight"} className="h-3 w-3" /> Inspect
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {step.nodeType && <Field label="Node type" value={<span className="font-mono text-fg-muted">{step.nodeType}</span>} />}
          {step.config != null && <JsonField label="Config" value={step.config} />}
          {step.input != null && <JsonField label="Input" value={step.input} />}
          {step.output != null && <JsonField label="Output" value={step.output} />}
          {step.prompt && (
            <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                <Icon name="MessageSquare" className="h-3 w-3" /> Prompt
              </div>
              {step.prompt.system && <PromptBlock role="system" text={step.prompt.system} />}
              {step.prompt.user && <PromptBlock role="user" text={step.prompt.user} />}
            </div>
          )}
          {step.memories && step.memories.length > 0 && <MemoriesField memories={step.memories} />}
          <ReplayNodeButton workflowId={workflowId} executionId={executionId} nodeId={step.nodeId} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-2.5 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</div>
      <div className="mt-0.5 text-xs">{value}</div>
    </div>
  );
}

function JsonField({ label, value }: { label: string; value: unknown }) {
  let pretty: string;
  try {
    pretty = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    pretty = String(value);
  }
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        <Icon name="Braces" className="h-3 w-3" /> {label}
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-fg-muted">
        {pretty}
      </pre>
    </div>
  );
}

function PromptBlock({ role, text }: { role: "system" | "user"; text: string }) {
  return (
    <div className="mt-1.5 first:mt-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{role}</div>
      <pre className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-fg-muted">{text}</pre>
    </div>
  );
}

function MemoriesField({ memories }: { memories: MemoryHit[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        <Icon name="Library" className="h-3 w-3" /> Memories ({memories.length})
      </div>
      <ul className="space-y-1.5">
        {memories.map((mem, mi) => (
          <li key={mi} className="rounded border border-border bg-bg/60 p-1.5">
            <div className="flex items-center gap-2 text-[10px] text-fg-subtle">
              <span className="font-mono">{mem.id}</span>
              {mem.scope && <span className="rounded bg-surface-3 px-1 py-0.5">{mem.scope}</span>}
              <span className="ml-auto tabular-nums">score {mem.score.toFixed(2)}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-fg-muted">{mem.content}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Per-node replay: re-executes one node server-side via the real replay route
// (POST …/nodes/[nodeId]/replay) and streams ExecutionEvent frames into an
// inline panel. Non-mutating — a pure "what would this produce now?" debug view.
function ReplayNodeButton({
  workflowId,
  executionId,
  nodeId,
}: {
  workflowId: string;
  executionId: string;
  nodeId: string;
}) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const run = async () => {
    setState("running");
    setLogs([]);
    setResult(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/executions/${executionId}/nodes/${nodeId}/replay`, {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by blank lines.
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const evt = JSON.parse(dataLine.slice(5).trim());
            handleReplayEvent(evt, setLogs, setResult);
          } catch {
            /* ignore malformed frame */
          }
        }
      }
      setState("done");
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Replay failed." });
      setState("done");
    }
  };

  return (
    <div>
      <Button variant="outline" size="sm" onClick={run} disabled={state === "running"}>
        {state === "running" ? <><Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Replaying…</> : <><Icon name="RotateCcw" className="h-3.5 w-3.5" /> Replay node</>}
      </Button>
      {(logs.length > 0 || result) && (
        <div className="mt-2 rounded-lg border border-border bg-bg/60 p-2 font-mono text-[10px] leading-relaxed">
          {logs.map((l, i) => (
            <div key={i} className="py-0.5 text-fg-muted">
              <span className="text-fg-subtle">{String(i + 1).padStart(2, "0")} </span>
              {l}
            </div>
          ))}
          {result && (
            <div className={cn("mt-1 py-0.5", result.ok ? "text-success" : "text-danger")}>
              {result.ok ? "✓ node succeeded" : `✗ ${result.error ?? "node failed"}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function handleReplayEvent(
  evt: { type: string; log?: string; error?: string; output?: unknown },
  setLogs: React.Dispatch<React.SetStateAction<string[]>>,
  setResult: React.Dispatch<React.SetStateAction<{ ok: boolean; error?: string } | null>>,
) {
  if (evt.type === "node:log" && evt.log) {
    setLogs((p) => [...p, evt.log as string]);
  } else if (evt.type === "node:success") {
    setResult({ ok: true });
    if (evt.output != null) {
      try {
        setLogs((p) => [...p, `output: ${JSON.stringify(evt.output)}`]);
      } catch {
        /* ignore */
      }
    }
  } else if (evt.type === "node:fail") {
    setResult({ ok: false, error: evt.error });
  }
}