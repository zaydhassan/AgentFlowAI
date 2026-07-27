import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CoreConceptCard, type CoreConcept } from "@/components/marketing/core-concept-card";
import { DocsSearch } from "@/components/docs/docs-search";

export const metadata: Metadata = {
  title: "Documentation — AgentFlow AI",
  description: "AgentFlow AI documentation — concepts, the visual builder, the Developer Guide, and reference.",
};

const concepts: CoreConcept[] = [
  {
    icon: "Workflow",
    category: "AI Orchestration",
    title: "Workflows & Nodes",
    tone: "brand",
    body: "Design workflows visually using typed nodes and intelligent branching. Compose triggers, transforms, and AI steps into reliable, reviewable runs.",
    bullets: ["60+ built-in nodes", "Conditional routing", "Parallel execution"],
    href: "/docs/workflows",
  },
  {
    icon: "BrainCircuit",
    category: "Intelligence Layer",
    title: "Agents & Memory",
    tone: "ai",
    body: "Invoke LLM-backed agents as nodes. Wire tools, persistent memory, and retrieval (RAG) into a single, observable run.",
    bullets: ["Persistent agent memory", "Tool & function calling", "RAG retrieval"],
    href: "/docs/agents",
  },
  {
    icon: "Activity",
    category: "Runtime",
    title: "Execution & Self-healing",
    tone: "success",
    body: "Understand the scheduler, retries, timeouts, and how runs recover from transient failures automatically — with full per-step observability.",
    bullets: ["Retry & timeout policies", "Self-healing runs", "Per-step observability"],
    href: "/docs/execution",
  },
  {
    icon: "KeyRound",
    category: "Trust & Access",
    title: "Secrets & Integrations",
    tone: "warning",
    body: "Store scoped credentials per workspace and connect the 60+ built-in integrations through a managed, encrypted vault.",
    bullets: ["Scoped workspace credentials", "60+ built-in integrations", "Encrypted OAuth vault"],
    href: "/docs/integrations",
  },
];

const guide = [
  {
    n: "01",
    title: "Install the CLI",
    code: "npm install -g @agentflow/cli",
    body: "Authenticate with an API key from your workspace settings and you're ready to push workflows from your repo.",
  },
  {
    n: "02",
    title: "Define a workflow as code",
    code: "agentflow init my-flow",
    body: "Scaffold a typed workflow file. The same schema powers the visual builder, so code and canvas stay in sync.",
  },
  {
    n: "03",
    title: "Run locally",
    code: "agentflow run",
    body: "Execute against the live runtime, stream node-level logs, and inspect every input/output inline.",
  },
  {
    n: "04",
    title: "Deploy",
    code: "agentflow deploy --env production",
    body: "Promote a versioned workflow to production. Roll back in one command if a run misbehaves.",
  },
];

export default function DocsPage() {
  return (
    <MarketingPage>
      <section className="relative mesh-bg overflow-hidden">
        <div className="relative mx-auto max-w-4xl px-5 lg:px-8 py-24 text-center">
          <Badge tone="ai" className="mx-auto mb-5">Documentation</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Build with <span className="text-brand-gradient">AgentFlow</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-muted">
            Everything you need to design, run, and operate AI-native workflows — from the visual
            builder to the command line.
          </p>
          <DocsSearch />
        </div>
      </section>

      {/* Concepts */}
      <section className="mx-auto max-w-5xl px-5 lg:px-8 py-20">
        <Badge tone="ai" className="mb-5">Documentation</Badge>
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Core Concepts
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
          Build, orchestrate and deploy autonomous AI systems with enterprise-grade tooling.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {concepts.map((c, i) => (
            <CoreConceptCard key={c.title} concept={c} index={i} />
          ))}
        </div>
      </section>

      {/* Developer Guide */}
      <section id="developer-guide" className="border-t border-border bg-bg-soft/40 scroll-mt-24">
        <div className="mx-auto max-w-5xl px-5 lg:px-8 py-20">
          <div className="flex items-center gap-2 text-ai">
            <Icon name="Terminal" className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Developer Guide</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">From zero to a running workflow</h2>
          <p className="mt-3 max-w-2xl text-fg-muted">
            Prefer the terminal? The CLI gives you the full power of AgentFlow with version control
            and CI-friendly commands.
          </p>

          <div className="mt-8 space-y-4">
            {guide.map((g) => (
              <div key={g.n} className="rounded-2xl border border-border bg-bg p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ai/10 text-sm font-semibold text-ai">
                    {g.n}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">{g.title}</h3>
                    <p className="mt-1 text-sm text-fg-muted">{g.body}</p>
                  </div>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface-2/60 px-4 py-3 text-xs text-fg-muted">
                  <code>{`$ ${g.code}`}</code>
                </pre>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-surface-2/30 p-6 text-sm text-fg-muted">
            <h3 className="text-sm font-semibold text-fg">Reference</h3>
            <p className="mt-2">
              A full REST &amp; event reference is coming. Until it ships, the Developer Guide above
              is the source of truth for the CLI and workflow schema. Track progress on the{" "}
              <Link href="/changelog" className="text-brand hover:underline">changelog</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 lg:px-8 pb-24">
        <div className="rounded-3xl border border-border mesh-bg p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Ready to build?</h2>
          <p className="mx-auto mt-3 max-w-md text-fg-muted">Start free with 1,000 credits — no card required.</p>
          <Link href="/signup" className="mt-6 inline-block"><Button size="lg" variant="ai"><Icon name="Rocket" className="h-4 w-4" /> Get started</Button></Link>
        </div>
      </section>
    </MarketingPage>
  );
}