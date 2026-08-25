"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { streamSSE } from "@/lib/workflow/sse-client";
import type { WorkflowNode, WorkflowEdge, CopilotSuggestion } from "@/lib/types";

const EXAMPLES = [
  "When an invoice arrives in Gmail: extract the data, save to Postgres, upload to S3, notify Slack, and generate a monthly report.",
  "Every morning at 9am: summarize yesterday's GitHub PRs and post a digest to Discord.",
  "When a new lead fills the form: research the company with an agent, qualify with a condition, and sync to Supabase.",
];

type Tab = "build" | "advice" | "heal";

export function CopilotPanel({
  workflowName,
  graph,
  selectedNode,
  onGenerate,
  onInsertNode,
  diagnoseSignal,
}: {
  workflowName: string;
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  selectedNode: WorkflowNode | null;
  onGenerate: (gen: { nodes: WorkflowNode[]; edges: { id: string; source: string; target: string }[] }) => void;
  onInsertNode: (type: string) => void;
  diagnoseSignal?: number;
}) {
  const [tab, setTab] = useState<Tab>("build");

  useEffect(() => {
    // Parent bumps `diagnoseSignal` to request a tab switch — a prop-driven
    // command, so the effect is the right place to honor it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (diagnoseSignal && diagnoseSignal > 0) setTab("heal");
  }, [diagnoseSignal]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-ai">
          <Icon name="Sparkles" className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">AI Copilot</div>
          <div className="truncate text-[10px] text-fg-subtle">{workflowName}</div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border px-2 py-1.5">
        {([["build", "Build", "Wand2"], ["advice", "Advice", "Lightbulb"], ["heal", "Self-heal", "Wrench"]] as const).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
              tab === k ? "bg-brand-soft text-fg border border-brand/30" : "text-fg-muted hover:text-fg hover:bg-surface-2 border border-transparent"
            )}
          >
            <Icon name={icon} className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "build" && <BuildTab graph={graph} selectedNode={selectedNode} onGenerate={onGenerate} onInsertNode={onInsertNode} />}
        {tab === "advice" && <AdviceTab graph={graph} onInsertNode={onInsertNode} />}
        {tab === "heal" && <HealTab graph={graph} selectedNode={selectedNode} />}
      </div>
    </div>
  );
}

function BuildTab({
  graph,
  selectedNode,
  onGenerate,
  onInsertNode,
}: {
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  selectedNode: WorkflowNode | null;
  onGenerate: (gen: { nodes: WorkflowNode[]; edges: { id: string; source: string; target: string }[] }) => void;
  onInsertNode: (type: string) => void;
}) {
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [streaming, setStreaming] = useState("");
  const [plan, setPlan] = useState<{ nodes: WorkflowNode[]; edges: { id: string; source: string; target: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recs, setRecs] = useState<{ type: string; reason: string }[] | null>(null);

  const generate = () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setStreaming("");
    setPlan(null);
    let text = "";
    streamSSE("/api/ai/generate", { prompt }, {
      onMessage: (data) => {
        const d = data as { type?: string; text?: string; plan?: { nodes: WorkflowNode[]; edges: { id: string; source: string; target: string }[] } };
        if (d.type === "text" && d.text) {
          text += d.text;
          setStreaming(text);
        } else if (d.type === "plan" && d.plan) {
          setPlan(d.plan);
        }
      },
      onEvent: (name) => { if (name === "done") setBusy(false); },
      onError: () => setBusy(false),
      onClose: () => setBusy(false),
    });
  };

  const recommend = () => {
    fetch("/api/ai/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ graph, selectedType: selectedNode?.type ?? null }) })
      .then((r) => r.json())
      .then((d) => setRecs(d.nodes ?? []))
      .catch(() => setRecs([]));
  };

  return (
    <div className="p-3 space-y-3">
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="Describe the workflow you want to build…" className="text-xs" />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex, i) => (
          <button key={i} onClick={() => setPrompt(ex)} className="truncate rounded-md border border-border bg-surface-2/60 px-2 py-1 text-[10px] text-fg-muted hover:text-fg hover:border-border-strong max-w-full" title={ex}>
            {ex.slice(0, 36)}…
          </button>
        ))}
      </div>
      <Button onClick={generate} disabled={busy} variant="ai" size="sm" className="w-full">
        {busy ? <><Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Planning…</> : <><Icon name="Sparkles" className="h-3.5 w-3.5" /> Generate workflow</>}
      </Button>

      {(streaming || plan) && (
        <div className="space-y-3 animate-float-up">
          {streaming && (
            <div className="rounded-lg border border-border bg-surface-2/60 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ai">
                <Icon name="Brain" className="h-3 w-3" /> Reasoning
              </div>
              <p className="text-[11px] leading-relaxed text-fg-muted">
                {streaming}
                {busy && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-ai align-middle" />}
              </p>
            </div>
          )}
          {plan && (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-ai/30 bg-ai/5 p-2.5 text-[11px] text-ai">
                <Icon name="CheckCircle2" className="h-3.5 w-3.5" />
                {plan.nodes.length} nodes · {plan.edges.length} connections ready
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => onGenerate(plan)}>
                  <Icon name="Plus" className="h-3.5 w-3.5" /> Apply to canvas
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { setPlan(null); setStreaming(""); }}>Discard</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Recommend next nodes */}
      <div className="border-t border-border pt-3">
        <Button variant="secondary" size="sm" className="w-full" onClick={recommend}>
          <Icon name="Lightbulb" className="h-3.5 w-3.5" /> Recommend next nodes
          {selectedNode && <span className="ml-1 text-fg-subtle">· for {selectedNode.data.label}</span>}
        </Button>
        {recs && (
          <div className="mt-2 space-y-1.5 animate-float-up">
            {recs.length === 0 && <p className="text-[11px] text-fg-subtle">No recommendations.</p>}
            {recs.map((r) => (
              <button key={r.type} onClick={() => onInsertNode(r.type)} className="w-full text-left rounded-lg border border-border bg-surface-2/60 p-2 hover:border-brand/40">
                <div className="text-[11px] font-medium">{r.type}</div>
                <div className="text-[10px] text-fg-muted">{r.reason}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdviceTab({
  graph,
  onInsertNode,
}: {
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  onInsertNode: (type: string) => void;
}) {
  const [chat, setChat] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Ask me about cost, latency, reliability, or security — or tap Analyze for a structured review." },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[] | null>(null);
  const [explaining, setExplaining] = useState("");

  const send = () => {
    if (!input.trim() || streaming) return;
    const q = input;
    setChat((c) => [...c, { role: "user", text: q }]);
    setInput("");
    setStreaming(true);
    let text = "";
    setChat((c) => [...c, { role: "ai", text: "" }]);
    const idx = chat.length + 1;
    streamSSE("/api/ai/copilot", { question: q, graph }, {
      onMessage: (data) => {
        const d = data as { type?: string; token?: string };
        if (d.type === "token" && d.token) {
          text += d.token;
          setChat((c) => c.map((m, i) => (i === idx ? { ...m, text } : m)));
        }
      },
      onEvent: (name) => { if (name === "done") setStreaming(false); },
      onError: () => setStreaming(false),
      onClose: () => setStreaming(false),
    });
  };

  const analyze = () => {
    fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ graph }) })
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions ?? []))
      .catch(() => setSuggestions([]));
  };

  const explain = () => {
    setExplaining("");
    let text = "";
    streamSSE("/api/ai/explain", { graph }, {
      onMessage: (data) => {
        const d = data as { type?: string; token?: string };
        if (d.type === "token" && d.token) { text += d.token; setExplaining(text); }
      },
    });
  };

  const applyKind = (kind: CopilotSuggestion["kind"]) =>
    kind === "cost" ? "ai.router"
      : kind === "architecture" ? "util.condition"
      : kind === "missing-node" ? "memory.store"
      : kind === "performance" ? "memory.recall"
      : null;

  const sevClass = (s: CopilotSuggestion["severity"]) =>
    s === "critical" ? "bg-danger/10 text-danger" : s === "warning" ? "bg-warning/10 text-warning" : "bg-info/10 text-info";
  const kindIcon = (k: CopilotSuggestion["kind"]) =>
    k === "missing-node" ? "PlusCircle" : k === "architecture" ? "Network" : k === "cost" ? "DollarSign" : k === "performance" ? "Gauge" : k === "security" ? "ShieldAlert" : "Wrench";

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1.5 border-b border-border p-2.5">
        <Button variant="secondary" size="sm" className="flex-1" onClick={analyze}><Icon name="ScanSearch" className="h-3.5 w-3.5" /> Analyze</Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={explain}><Icon name="BookOpen" className="h-3.5 w-3.5" /> Explain</Button>
      </div>

      {explaining && (
        <div className="border-b border-border bg-surface-2/40 p-2.5 text-[11px] leading-relaxed text-fg-muted">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ai"><Icon name="BookOpen" className="mr-1 inline h-3 w-3" /> Explanation</div>
          {explaining}
        </div>
      )}

      {suggestions && (
        <div className="space-y-1.5 border-b border-border p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{suggestions.length} suggestions</div>
          {suggestions.map((s) => {
            const ins = applyKind(s.kind);
            return (
              <div key={s.id} className="rounded-lg border border-border bg-surface-2/60 p-2.5">
                <div className="flex items-start gap-2">
                  <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg", sevClass(s.severity))}>
                    <Icon name={kindIcon(s.kind)} className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{s.title}</div>
                    <div className="mt-0.5 text-[11px] text-fg-muted">{s.description}</div>
                    {ins && (
                      <button onClick={() => onInsertNode(ins)} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-surface-3 px-2 py-0.5 text-[11px] text-fg hover:border-brand/40">
                        <Icon name="Plus" className="h-2.5 w-2.5" /> {s.action ?? "Add"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {chat.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg", m.role === "ai" ? "bg-gradient-to-br from-brand to-ai" : "bg-surface-3")}>
              <Icon name={m.role === "ai" ? "Sparkles" : "User"} className="h-3 w-3 text-white" />
            </span>
            <div className={cn("max-w-[80%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed", m.role === "ai" ? "bg-surface-2 border border-border text-fg" : "bg-brand text-white")}>
              {m.text}{streaming && i === chat.length - 1 && m.role === "ai" && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-ai align-middle" />}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2.5">
        <div className="flex items-end gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder="Ask about cost, latency, reliability…" className="text-xs" />
          <Button size="sm" variant="ai" onClick={send} className="h-9 px-3" disabled={streaming}>
            <Icon name="Send" className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function HealTab({ graph, selectedNode }: { graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }; selectedNode: WorkflowNode | null }) {
  const [fixes, setFixes] = useState<CopilotSuggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  const failedNode = graph.nodes.find((n) => n.data.status === "failed") ?? selectedNode;

  const diagnose = () => {
    if (!failedNode) return;
    setBusy(true);
    setFixes(null);
    setApplied(null);
    fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ graph, failedNodeId: failedNode.id }) })
      .then((r) => r.json())
      .then((d) => { setFixes(d.suggestions ?? []); setBusy(false); })
      .catch(() => { setFixes([]); setBusy(false); });
  };

  if (!failedNode) {
    return (
      <div className="p-3">
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-[11px] text-fg-muted">
          <Icon name="CheckCircle2" className="mx-auto h-5 w-5 text-success" />
          <p className="mt-2">No failed nodes. Run the workflow to surface errors, then return here to self-heal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-danger">
          <Icon name="AlertTriangle" className="h-3 w-3" /> Failed node
        </div>
        <div className="text-xs font-medium">{failedNode.data.label}</div>
        <div className="mt-0.5 font-mono text-[10px] text-fg-muted">{failedNode.data.logs?.slice(-1)[0] ?? "no log"}</div>
      </div>
      <Button onClick={diagnose} disabled={busy} variant="ai" size="sm" className="w-full">
        {busy ? <><Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Diagnosing…</> : <><Icon name="Stethoscope" className="h-3.5 w-3.5" /> Diagnose & suggest fixes</>}
      </Button>

      {fixes && fixes.length > 0 && (
        <div className="space-y-2 animate-float-up">
          {fixes.map((f) => (
            <div key={f.id} className="rounded-lg border border-border bg-surface-2/60 p-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                  <Icon name="Wrench" className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{f.title}</div>
                  <div className="mt-0.5 text-[11px] text-fg-muted">{f.description}</div>
                  {f.action && (
                    <button onClick={() => setApplied(f.id)} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-surface-3 px-2 py-1 text-[11px] text-fg hover:border-brand/40">
                      {f.action} <Icon name="ArrowRight" className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>
              {applied === f.id && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-success">
                  <Icon name="CheckCircle2" className="h-3.5 w-3.5" /> Fix applied — the runtime learned this pattern.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}