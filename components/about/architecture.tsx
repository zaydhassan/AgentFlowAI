// "Technology & architecture" — three pillars. Body copy is the previous
// About page's verified architecture description, preserved verbatim.
// Server component.

import { BlurReveal, StaggerContainer, StaggerItem } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

const PILLARS = [
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
];

export function Architecture() {
  return (
    <section className="relative border-y border-border bg-bg-soft/30">
      <div className="mx-auto max-w-6xl px-5 py-24 lg:px-8">
        <BlurReveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-ai">
            Technology &amp; architecture
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            A typed, event-driven runtime.
          </h2>
          <p className="mx-auto mt-5 text-fg-muted">
            A workflow is a graph of nodes; each node is a small, versioned unit of work. The
            orchestrator executes the graph, streams progress, and persists every step so runs are
            resumable and auditable.
          </p>
        </BlurReveal>

        <StaggerContainer className="mt-14 grid gap-4 md:grid-cols-3" stagger={0.1}>
          {PILLARS.map((c, i) => (
            <StaggerItem
              key={c.title}
              className="rounded-2xl border border-border bg-surface-2/40 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-ai">
                  <Icon name={c.icon} className="h-4.5 w-4.5" />
                </span>
                <span className="font-mono text-xs text-fg-subtle">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{c.body}</p>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}