"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/input";
import { generateWorkflowFromPrompt } from "@/lib/mock/ai";
import { copilotSuggestions } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "When an invoice arrives in Gmail: extract the data, save to Postgres, upload to S3, notify Slack, and generate a monthly report.",
  "Every morning: summarize new GitHub PRs and post a digest to Discord.",
  "When a lead fills the form: research the company, qualify it, and sync to Supabase.",
];

const agents = [
  { icon: "Workflow", name: "Planner", desc: "Decomposes large requests into executable tasks.", color: "#7c5cff", href: "/ai/agents" },
  { icon: "Search", name: "Research", desc: "Browses, reads docs, summarizes, extracts info.", color: "#22d3ee", href: "/ai/agents" },
  { icon: "Brain", name: "Memory", desc: "Long-term memory across runs and users.", color: "#f59e0b", href: "/ai/memory" },
  { icon: "Route", name: "AI Router", desc: "Picks the best model per task, live.", color: "#34d399", href: "/ai/agents" },
  { icon: "Library", name: "RAG", desc: "Retrieval over your documents & knowledge.", color: "#a855f7", href: "/ai/rag" },
  { icon: "Wrench", name: "Self-healing", desc: "Diagnoses failures, fixes, and retries.", color: "#fb7185", href: "/ai" },
];

export default function AICopilotPage() {
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<ReturnType<typeof generateWorkflowFromPrompt> | null>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    setResult(null);
    setTimeout(() => {
      setResult(generateWorkflowFromPrompt(prompt));
      setBusy(false);
    }, 700);
  };

  return (
    <div className="animate-float-up">
      <PageHeader
        title="AI Copilot"
        description="Your workflow engineer. Describe what you want, get a working workflow — plus continuous optimization."
        actions={<Badge tone="ai"><span className="dot dot-live bg-ai mr-1.5" /> 4 agents ready</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* NL builder */}
        <Card className="xl:col-span-2 mesh-bg overflow-hidden">
          <div className="relative">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-ai">
                  <Icon name="Wand2" className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle>Natural-language workflow builder</CardTitle>
                  <CardDescription>Describe your automation in plain English.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="e.g. When an invoice arrives in Gmail…" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => setPrompt(ex)} className="rounded-md border border-border bg-surface-2/60 px-2 py-1 text-[11px] text-fg-muted hover:text-fg">
                    Example {i + 1}
                  </button>
                ))}
              </div>
              <Button onClick={run} disabled={busy} variant="ai" size="md" className="mt-4">
                {busy ? <><Icon name="LoaderCircle" className="h-4 w-4 animate-spin" /> Planning your workflow…</> : <><Icon name="Sparkles" className="h-4 w-4" /> Generate workflow</>}
              </Button>

              {result && (
                <div className="mt-5 space-y-3 animate-float-up">
                  <div className="rounded-lg border border-ai/30 bg-ai/5 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ai">
                      <Icon name="Brain" className="h-3 w-3" /> Reasoning
                    </div>
                    <p className="text-xs leading-relaxed text-fg-muted">{result.reasoning}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border bg-surface-2/60 p-3 text-center">
                      <div className="text-2xl font-semibold text-brand-gradient">{result.nodes.length}</div>
                      <div className="text-[10px] text-fg-subtle">nodes generated</div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-2/60 p-3 text-center">
                      <div className="text-2xl font-semibold text-brand-gradient">{result.edges.length}</div>
                      <div className="text-[10px] text-fg-subtle">connections</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2/60 p-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Execution plan</div>
                    <ol className="space-y-1.5">
                      {result.plan.map((p, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-brand-soft text-brand text-[10px]">{i + 1}</span>
                          <span className="text-fg-muted">{p}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/workflows/wf_invoice"><Button size="sm" className="flex-1"><Icon name="Workflow" className="h-3.5 w-3.5" /> Open in builder</Button></Link>
                    <Button size="sm" variant="secondary" onClick={() => setResult(null)}>Discard</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </Card>

        {/* Agents */}
        <Card>
          <CardHeader><CardTitle>AI Agents</CardTitle><CardDescription>Your autonomous workforce</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {agents.map((a) => (
              <Link key={a.name} href={a.href} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-2.5 hover:border-border-strong transition-colors">
                <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: `${a.color}22`, color: a.color }}>
                  <Icon name={a.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{a.name}</div>
                  <div className="truncate text-[10px] text-fg-subtle">{a.desc}</div>
                </div>
                <Icon name="ArrowRight" className="h-3.5 w-3.5 text-fg-subtle" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Copilot suggestions */}
      <Card className="mt-4">
        <CardHeader><CardTitle>Copilot Suggestions</CardTitle><CardDescription>Continuous optimization across all workflows</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {copilotSuggestions.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-surface-2/40 p-3 card-hover">
              <div className="flex items-center gap-2">
                <span className={cn("grid h-7 w-7 place-items-center rounded-lg", s.severity === "critical" ? "bg-danger/10 text-danger" : s.severity === "warning" ? "bg-warning/10 text-warning" : "bg-info/10 text-info")}>
                  <Icon name={s.kind === "missing-node" ? "PlusCircle" : s.kind === "architecture" ? "Network" : s.kind === "cost" ? "DollarSign" : s.kind === "performance" ? "Gauge" : s.kind === "security" ? "ShieldAlert" : "Wrench"} className="h-3.5 w-3.5" />
                </span>
                <Badge tone={s.severity === "critical" ? "danger" : s.severity === "warning" ? "warning" : "info"}>{s.kind.replace("-", " ")}</Badge>
              </div>
              <div className="mt-2 text-xs font-medium">{s.title}</div>
              <div className="mt-1 text-[11px] text-fg-muted">{s.description}</div>
              {s.action && <button className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand hover:underline">{s.action} <Icon name="ArrowRight" className="h-2.5 w-2.5" /></button>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}