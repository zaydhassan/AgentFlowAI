"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { generateWorkflowFromPrompt, mockCopilotReply, selfHealSuggestions } from "@/lib/mock/ai";
import { copilotSuggestions } from "@/lib/mock/data";
import type { WorkflowNode, CopilotSuggestion } from "@/lib/types";

const EXAMPLES = [
  "When an invoice arrives in Gmail: extract the data, save to Postgres, upload to S3, notify Slack, and generate a monthly report.",
  "Every morning at 9am: summarize yesterday's GitHub PRs and post a digest to Discord.",
  "When a new lead fills the form: research the company with an agent, qualify with a condition, and sync to Supabase.",
];

type Tab = "build" | "copilot" | "heal";

export function CopilotPanel({
  workflowName,
  nodeCount,
  onGenerate,
  onInspect,
}: {
  workflowName: string;
  nodeCount: number;
  onGenerate: (gen: { nodes: WorkflowNode[]; edges: { id: string; source: string; target: string }[] }) => void;
  onInspect: () => void;
}) {
  const [tab, setTab] = useState<Tab>("build");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-ai">
          <Icon name="Sparkles" className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold">AI Copilot</div>
          <div className="text-[10px] text-fg-subtle">your workflow engineer</div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border px-2 py-1.5">
        {([["build", "Build", "Wand2"], ["copilot", "Advice", "Lightbulb"], ["heal", "Self-heal", "Wrench"]] as const).map(([k, label, icon]) => (
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
        {tab === "build" && <BuildTab onGenerate={onGenerate} onInspect={onInspect} />}
        {tab === "copilot" && <CopilotTab />}
        {tab === "heal" && <HealTab />}
      </div>
    </div>
  );
}

function BuildTab({
  onGenerate,
  onInspect,
}: {
  onGenerate: (gen: { nodes: WorkflowNode[]; edges: { id: string; source: string; target: string }[] }) => void;
  onInspect: () => void;
}) {
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<ReturnType<typeof generateWorkflowFromPrompt> | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = () => {
    setBusy(true);
    setTimeout(() => {
      const r = generateWorkflowFromPrompt(prompt);
      setResult(r);
      setBusy(false);
    }, 650);
  };

  return (
    <div className="p-3 space-y-3">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="Describe the workflow you want to build…"
        className="text-xs"
      />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => setPrompt(ex)}
            className="truncate rounded-md border border-border bg-surface-2/60 px-2 py-1 text-[10px] text-fg-muted hover:text-fg hover:border-border-strong max-w-full"
            title={ex}
          >
            {ex.slice(0, 36)}…
          </button>
        ))}
      </div>
      <Button onClick={generate} disabled={busy} variant="ai" size="sm" className="w-full">
        {busy ? <><Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Planning…</> : <><Icon name="Sparkles" className="h-3.5 w-3.5" /> Generate workflow</>}
      </Button>

      {result && (
        <div className="space-y-3 animate-float-up">
          <div className="rounded-lg border border-border bg-surface-2/60 p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ai">
              <Icon name="Brain" className="h-3 w-3" /> Reasoning
            </div>
            <p className="text-[11px] leading-relaxed text-fg-muted">{result.reasoning}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2/60 p-2.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Plan</div>
            <ol className="space-y-1">
              {result.plan.map((p, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-fg-muted">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-brand-soft text-brand text-[9px]">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-ai/30 bg-ai/5 p-2.5 text-[11px] text-ai">
            <Icon name="CheckCircle2" className="h-3.5 w-3.5" />
            {result.nodes.length} nodes · {result.edges.length} connections ready
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                onGenerate(result);
                onInspect();
              }}
            >
              <Icon name="Plus" className="h-3.5 w-3.5" /> Apply to canvas
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setResult(null)}>Discard</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CopilotTab() {
  const [chat, setChat] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "I've analyzed this workflow. I see a few improvements — tap any suggestion below or ask me anything." },
  ]);
  const [input, setInput] = useState("");

  const send = () => {
    if (!input.trim()) return;
    const q = input;
    setChat((c) => [...c, { role: "user", text: q }]);
    setInput("");
    setTimeout(() => setChat((c) => [...c, { role: "ai", text: mockCopilotReply(q) }]), 350);
  };

  const severityTone = (s: CopilotSuggestion["severity"]) => (s === "critical" ? "danger" : s === "warning" ? "warning" : "info");
  const kindIcon = (k: CopilotSuggestion["kind"]) =>
    k === "missing-node" ? "PlusCircle" : k === "architecture" ? "Network" : k === "cost" ? "DollarSign" : k === "performance" ? "Gauge" : k === "security" ? "ShieldAlert" : "Wrench";

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 space-y-2 border-b border-border">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle px-1">Suggestions</div>
        {copilotSuggestions.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-surface-2/60 p-2.5">
            <div className="flex items-start gap-2">
              <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg", s.severity === "critical" ? "bg-danger/10 text-danger" : s.severity === "warning" ? "bg-warning/10 text-warning" : "bg-info/10 text-info")}>
                <Icon name={kindIcon(s.kind)} className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">{s.title}</div>
                <div className="mt-0.5 text-[11px] text-fg-muted">{s.description}</div>
                {s.action && (
                  <button className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-brand hover:underline">
                    {s.action} <Icon name="ArrowRight" className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {chat.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg", m.role === "ai" ? "bg-gradient-to-br from-brand to-ai" : "bg-surface-3")}>
              <Icon name={m.role === "ai" ? "Sparkles" : "User"} className="h-3 w-3 text-white" />
            </span>
            <div className={cn("max-w-[80%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed", m.role === "ai" ? "bg-surface-2 border border-border text-fg" : "bg-brand text-white")}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-2.5">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Ask about cost, latency, reliability…"
            className="text-xs"
          />
          <Button size="sm" variant="ai" onClick={send} className="h-9 px-3">
            <Icon name="Send" className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function HealTab() {
  const [error, setError] = useState("HTTP 401 Unauthorized: token expired");
  const [fixes, setFixes] = useState<CopilotSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [healed, setHealed] = useState(false);

  const analyze = () => {
    setBusy(true);
    setHealed(false);
    setTimeout(() => {
      setFixes(selfHealSuggestions(error));
      setBusy(false);
    }, 600);
  };

  const presets = ["HTTP 401 Unauthorized: token expired", "429 Too Many Requests: rate limited", "ETIMEDOUT: request timed out after 30000ms"];

  return (
    <div className="p-3 space-y-3">
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-danger">
          <Icon name="AlertTriangle" className="h-3 w-3" /> Last failure
        </div>
        <Textarea value={error} onChange={(e) => setError(e.target.value)} rows={2} className="font-mono text-[11px] border-danger/20" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p} onClick={() => setError(p)} className="rounded-md border border-border bg-surface-2/60 px-2 py-1 text-[10px] text-fg-muted hover:text-fg">
            {p.split(":")[0]}
          </button>
        ))}
      </div>
      <Button onClick={analyze} disabled={busy} variant="ai" size="sm" className="w-full">
        {busy ? <><Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" /> Diagnosing…</> : <><Icon name="Stethoscope" className="h-3.5 w-3.5" /> Diagnose & suggest fixes</>}
      </Button>

      {fixes.length > 0 && (
        <div className="space-y-2 animate-float-up">
          <div className="rounded-lg border border-border bg-surface-2/60 p-2.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Root cause</div>
            <p className="text-[11px] text-fg-muted">{fixes[0].description}</p>
          </div>
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
                    <button
                      onClick={() => setHealed(true)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-surface-3 px-2 py-1 text-[11px] text-fg hover:border-brand/40"
                    >
                      {f.action} <Icon name="ArrowRight" className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {healed && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-2.5 text-[11px] text-success animate-float-up">
              <Icon name="CheckCircle2" className="h-3.5 w-3.5" /> Fix applied — node retried successfully. The runtime learned this pattern.
            </div>
          )}
        </div>
      )}
    </div>
  );
}