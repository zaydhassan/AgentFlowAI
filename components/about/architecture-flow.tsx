// Architecture flow — how an agent run moves through the system:
// EVENT → REASONING → ACTION → STORAGE → OBSERVABILITY. Every node card is a
// real node type from lib/nodes NODE_LIBRARY (resolved by type, throwing if
// the definition ever disappears). Uses the shared FlowChain for the cards +
// connectors; the phase legend below is decorative labeling of the same chain.
//
// The FlowChain itself is the visualization; on mobile it scrolls
// horizontally inside its own container (never the page).

import { NODE_LIBRARY } from "@/lib/nodes";
import { FlowChain, type FlowNodeItem } from "@/components/marketing/flow-chain";
import { BlurReveal } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

const FLOW_TYPES = [
  { type: "trigger.schedule", sub: "Event", color: "#f59e0b" },
  { type: "ai.agent", sub: "Reasoning", color: "#7c5cff" },
  { type: "mcp.tool", sub: "Action", color: "#22d3ee" },
  { type: "store.postgres", sub: "Persist", color: "#5b8bff" },
  { type: "cloud.s3", sub: "Storage", color: "#34d399" },
  { type: "comm.slack", sub: "Notify", color: "#ec4899" },
  { type: "doc.pdf", sub: "Report", color: "#a1a1aa" },
] as const;

const FLOW_LEGEND = [
  { icon: "Zap", label: "Event", desc: "A trigger starts the run" },
  { icon: "BrainCircuit", label: "Reasoning", desc: "The agent plans and decides" },
  { icon: "Plug", label: "Action", desc: "Tools execute real work" },
  { icon: "Database", label: "Storage", desc: "State is persisted" },
  { icon: "Eye", label: "Observability", desc: "Every step is streamed & logged" },
] as const;

// Resolve real node definitions once at module scope.
const FLOW_NODES = FLOW_TYPES.map((f) => {
  const def = NODE_LIBRARY.find((n) => n.type === f.type);
  if (!def) throw new Error(`node def missing: ${f.type}`);
  return { label: def.label, sub: f.sub, icon: def.icon, color: f.color } satisfies FlowNodeItem;
});

export function ArchitectureFlow() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(52% 55% at 50% 40%, rgba(124,92,255,0.1), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-5 py-24 lg:px-8">
        <BlurReveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            How agents flow
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Event → reasoning → action → storage.
          </h2>
          <p className="mt-5 text-fg-muted">
            Every run follows the same observable path. Real node types from the AgentFlow library:
          </p>
        </BlurReveal>

        <BlurReveal delay={0.1} className="mt-12">
          <FlowChain nodes={FLOW_NODES} />
        </BlurReveal>

        {/* Phase legend — labels the same chain above. */}
        <BlurReveal delay={0.15} className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FLOW_LEGEND.map((s) => (
            <div
              key={s.label}
              className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/40 p-3.5"
            >
              <Icon name={s.icon} className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <div>
                <div className="text-xs font-semibold">{s.label}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-fg-subtle">{s.desc}</div>
              </div>
            </div>
          ))}
        </BlurReveal>

        <p className="mt-8 text-center text-[11px] text-fg-subtle">
          Runtime detail — every run streams live progress, logs, latency, and cost, and can be
          replayed from any step.
        </p>
      </div>
    </section>
  );
}