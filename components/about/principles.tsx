// "What we believe" — 2×2 principle blocks. The four principles are the
// About page's existing values, verbatim. Hover: border illuminates, icon
// glows, content lifts 1–2px. Pure Tailwind; no client JS.

import { BlurReveal, StaggerContainer, StaggerItem } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

const PRINCIPLES = [
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

export function Principles() {
  return (
    <section className="relative border-y border-border bg-bg-soft/30">
      <div className="mx-auto max-w-6xl px-5 py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <BlurReveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              What we believe
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Four principles behind every design decision.
            </h2>
          </BlurReveal>

          <StaggerContainer className="grid gap-4 sm:grid-cols-2" stagger={0.1}>
            {PRINCIPLES.map((p) => (
              <StaggerItem
                key={p.title}
                className="group rounded-2xl border border-border bg-surface-2/40 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2/70"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-brand transition-shadow duration-300 group-hover:shadow-[0_0_18px_-2px_rgba(124,92,255,0.55)]">
                  <Icon name={p.icon} className="h-4.5 w-4.5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{p.body}</p>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </div>
    </section>
  );
}