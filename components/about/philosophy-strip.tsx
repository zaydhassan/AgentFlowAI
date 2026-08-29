// Philosophy strip — four operating beliefs in a divided row. Copy stays
// modest and verifiable (auditable runs, public changelog). Server component.

import { BlurReveal } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

const CREEDS = [
  { icon: "Hammer", title: "Built by builders", copy: "We judge our own product by whether we run our work on it." },
  { icon: "Users", title: "Customer obsessed", copy: "The roadmap is shaped by the workflows our users actually build." },
  { icon: "Lock", title: "Security first", copy: "Auditable steps and transparent runs — security as a requirement, not a badge." },
  { icon: "RefreshCw", title: "Always improving", copy: "Small, frequent releases — every one documented on the public changelog." },
];

export function PhilosophyStrip() {
  return (
    <section className="border-b border-border">
      <BlurReveal className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface/40 p-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:p-0 lg:divide-x lg:divide-border">
          {CREEDS.map((c) => (
            <div key={c.title} className="flex items-start gap-3.5 lg:px-7 lg:py-6">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2">
                <Icon name={c.icon} className="h-4 w-4 text-brand" />
              </span>
              <div>
                <div className="text-sm font-semibold">{c.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{c.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </BlurReveal>
    </section>
  );
}