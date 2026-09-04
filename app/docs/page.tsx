import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Icon } from "@/components/ui/icon";
import { type CoreConcept } from "@/components/marketing/core-concept-card";
import { DocsBackground } from "@/components/docs/docs-background";
import { DocumentationHero } from "@/components/docs/docs-hero";
import { ConceptCard } from "@/components/docs/concept-card";
import { DeveloperTimeline, DocsCallout } from "@/components/docs/developer-timeline";
import { DocumentationCta } from "@/components/docs/docs-cta";

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
      {/* One consistent page background behind every section. */}
      <div className="relative isolate">
        <DocsBackground />

        <DocumentationHero />

        {/* Core Concepts grid — 2×2 desktop, 2 tablet, 1 mobile. */}
        <section aria-label="Core concepts" className="relative mx-auto max-w-5xl px-5 pb-20 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {concepts.map((c, i) => (
              <ConceptCard key={c.title} concept={c} index={i} />
            ))}
          </div>
        </section>

        {/* Developer Guide */}
        <section
          id="developer-guide"
          className="relative border-t border-border bg-bg-soft/40 scroll-mt-24"
        >
          <div className="mx-auto max-w-5xl px-5 py-20 lg:px-8">
            <div className="flex items-center gap-2 text-ai">
              <Icon name="Terminal" className="h-4 w-4" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-widest">
                01 · Developer Guide
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              From zero to a running workflow
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-muted">
              Prefer the terminal? The CLI gives you the full power of AgentFlow with version
              control and CI-friendly commands.
            </p>

            <DeveloperTimeline steps={guide} />

            <div className="mt-10">
              <DocsCallout
                title="Reference"
                action={
                  <Link
                    href="/changelog"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-brand transition-opacity hover:opacity-80 focus-ring rounded-sm"
                  >
                    Track progress
                    <Icon name="ArrowRight" className="h-4 w-4" aria-hidden />
                  </Link>
                }
              >
                A full REST &amp; event reference is coming. Until it ships, the Developer Guide
                above is the source of truth for the CLI and workflow schema. Track progress on the{" "}
                <Link href="/changelog" className="text-brand hover:underline">
                  changelog
                </Link>
                .
              </DocsCallout>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section aria-label="Get started" className="relative mx-auto max-w-5xl px-5 pb-24 pt-16 lg:px-8">
          <DocumentationCta />
        </section>
      </div>
    </MarketingPage>
  );
}