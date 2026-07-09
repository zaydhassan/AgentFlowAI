import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "About — AgentFlow AI",
  description:
    "AgentFlow AI is the AI-native automation platform. Learn about our mission, the problem we solve, our technology, and where we're headed.",
};

const values = [
  {
    icon: "ShieldCheck",
    title: "Reliability over magic",
    body: "AI is unreliable by default. Our job is to make it dependable — observable, self-healing, and auditable.",
  },
  {
    icon: "Layers",
    title: "Compose, don't rebuild",
    body: "Great automations combine many tools. We make composition first-class, so you never start from zero.",
  },
  {
    icon: "Eye",
    title: "Transparency by default",
    body: "Every step is traceable. You can always see what an agent decided, why, and what it did next.",
  },
  {
    icon: "Gauge",
    title: "Latency is a feature",
    body: "Automations have to feel instant. We engineer for low-latency execution from the first node to the last.",
  },
];

const roadmap = [
  {
    phase: "Now",
    status: "Shipped",
    tone: "success" as const,
    items: [
      "Visual workflow builder with 60+ nodes",
      "AI agents with persistent memory & RAG",
      "Self-healing runs with automatic retries",
    ],
  },
  {
    phase: "Next",
    status: "In progress",
    tone: "ai" as const,
    items: [
      "Native MCP server & client nodes",
      "Multi-agent orchestration with shared state",
      "Workflow branching & parallel execution",
    ],
  },
  {
    phase: "Later",
    status: "Planned",
    tone: "neutral" as const,
    items: [
      "Self-hosted enterprise deployment",
      "Custom node SDK & private registry",
      "On-device model routing for sensitive data",
    ],
  },
];

export default function AboutPage() {
  return (
    <MarketingPage>
      {/* Hero */}
      <section className="relative mesh-bg overflow-hidden">
        <div className="relative mx-auto max-w-4xl px-5 lg:px-8 py-24 text-center">
          <Badge tone="ai" className="mx-auto mb-5">About</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            We&apos;re building the <span className="text-brand-gradient">control plane</span> for AI work.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-muted">
            AgentFlow AI is the AI-native automation platform. We let teams ship workflows that
            think, plan, reason, remember, and self-heal — so the boring, brittle, manual work
            gets done without someone babysitting it.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/contact"><Button size="lg" variant="ai"><Icon name="Mail" className="h-4 w-4" /> Talk to us</Button></Link>
            <Link href="/#features"><Button size="lg" variant="secondary"><Icon name="Sparkles" className="h-4 w-4" /> Explore the product</Button></Link>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-3xl px-5 lg:px-8 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">The problem</h2>
        <div className="mt-6 space-y-4 text-fg-muted">
          <p>
            Every team has the same backlog of work that <em>should</em> be automated: triaging
            tickets, enriching leads, summarizing docs, moving data between the eight tools they
            already pay for. Traditional automation platforms solved the easy version — fixed
            triggers, fixed steps, fixed outputs.
          </p>
          <p>
            But the moment a step needs judgment — &ldquo;is this urgent?&rdquo;, &ldquo;does this
            match the policy?&rdquo;, &ldquo;which record does this belong to?&rdquo; — those
            platforms break. Someone ends up back in the loop, doing it by hand.
          </p>
          <p>
            LLMs were supposed to fix this. Instead they gave us a new problem: they&apos;re
            powerful but unreliable, stateless by default, and impossible to observe once chained
            together. Teams bolted scripts onto chat windows and called it a product.
          </p>
        </div>
      </section>

      {/* Mission / Vision */}
      <section className="border-y border-border bg-bg-soft/40">
        <div className="mx-auto max-w-5xl px-5 lg:px-8 py-16 grid gap-8 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 text-brand">
              <Icon name="Target" className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">Mission</span>
            </div>
            <p className="mt-3 text-lg text-fg">
              Make dependable AI automation accessible to every team — not just the ones with a
              platform engineering org.
            </p>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-ai">
              <Icon name="Telescope" className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">Vision</span>
            </div>
            <p className="mt-3 text-lg text-fg">
              A world where &ldquo;there&apos;s an automation for that&rdquo; is the default answer
            to any repetitive task — and where every one of those automations is trustworthy
            enough to run while you sleep.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-5xl px-5 lg:px-8 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">What we believe</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="card-hover rounded-2xl border border-border bg-surface-2/40 p-6">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon name={v.icon} className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{v.title}</h3>
              <p className="mt-1.5 text-sm text-fg-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Technology / Architecture */}
      <section className="border-t border-border bg-bg-soft/40">
        <div className="mx-auto max-w-5xl px-5 lg:px-8 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Technology &amp; architecture</h2>
          <p className="mt-4 max-w-2xl text-fg-muted">
            AgentFlow is a typed, event-driven runtime. A workflow is a graph of nodes; each node
            is a small, versioned unit of work. The orchestrator executes the graph, streams
            progress, and persists every step so runs are resumable and auditable.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: "Workflow",
                title: "Visual runtime",
                body: "A graph editor backed by a deterministic scheduler. Drag nodes, wire outputs, and the same graph runs in prod.",
              },
              {
                icon: "BrainCircuit",
                title: "Agent layer",
                body: "LLM-backed agents with tools, persistent memory, and retrieval — invoked as nodes, governed by the same retry & timeout rules.",
              },
              {
                icon: "Activity",
                title: "Observability",
                body: "Every node logs inputs, outputs, latency, and cost. Self-healing runs surface what failed and how it recovered.",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-border bg-bg p-6">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-ai/10 text-ai">
                  <Icon name={c.icon} className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm text-fg-muted">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-fg-subtle">
            Built with Next.js &amp; FastAPI, Postgres for state, and a streaming execution engine
            designed to stay responsive at thousands of concurrent runs.
          </p>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mx-auto max-w-5xl px-5 lg:px-8 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Where we&apos;re headed</h2>
        <div className="mt-8 space-y-4">
          {roadmap.map((r) => (
            <div key={r.phase} className="card-hover rounded-2xl border border-border bg-surface-2/40 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{r.phase}</h3>
                <Badge tone={r.tone}>{r.status}</Badge>
              </div>
              <ul className="mt-4 space-y-2">
                {r.items.map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-fg-muted">
                    <Icon name="Check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-fg-subtle">
          See the latest shipped changes on the <Link href="/changelog" className="text-brand hover:underline">changelog</Link>.
        </p>
      </section>
    </MarketingPage>
  );
}