// Roadmap — vertical timeline reusing the About page's existing roadmap
// content verbatim (Now/NEXT/LATER with their real statuses and items).
// Glowing status dots; entrance stagger; changelog link preserved.
// Server component.

import Link from "next/link";
import { BlurReveal, StaggerContainer, StaggerItem } from "@/components/marketing/motion";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

const ROADMAP = [
  {
    phase: "Now",
    status: "Shipped",
    tone: "success" as const,
    dot: "bg-success border-success",
    itemIcon: "Check",
    glow: "rgba(52,211,153,0.6)",
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
    dot: "bg-ai border-ai",
    itemIcon: "CircleDot",
    glow: "rgba(34,211,238,0.6)",
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
    dot: "bg-surface-3 border-border-strong",
    itemIcon: "Clock",
    glow: "rgba(255,255,255,0.15)",
    items: [
      "Self-hosted enterprise deployment",
      "Custom node SDK & private registry",
      "On-device model routing for sensitive data",
    ],
  },
];

export function Roadmap() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <BlurReveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Where we&apos;re going</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            A roadmap you can hold us to.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-fg-muted">
            Shipped work is documented, in-progress work is shared early, and planned work is
            labeled honestly. See the latest changes on the{" "}
            <Link href="/changelog" className="text-brand hover:underline">
              changelog
            </Link>
            .
          </p>
        </BlurReveal>

        <StaggerContainer className="relative rounded-2xl border border-border bg-surface-2/30 p-6 pl-10 sm:p-8 sm:pl-12" stagger={0.14}>
          {/* Timeline spine */}
          <div
            className="absolute bottom-8 left-[29px] top-8 w-px bg-gradient-to-b from-success/60 via-ai/50 to-fg-subtle/20 sm:left-[37px]"
            aria-hidden
          />
          {ROADMAP.map((r) => (
            <StaggerItem key={r.phase} className="relative pb-10 last:pb-0">
              {/* Glowing milestone node */}
              <span
                className={`absolute -left-[18px] top-0.5 h-3.5 w-3.5 rounded-full border-2 sm:-left-[22px] ${r.dot}`}
                style={{ boxShadow: `0 0 14px 1px ${r.glow}` }}
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold tracking-tight">{r.phase}</h3>
                <Badge tone={r.tone}>{r.status}</Badge>
              </div>
              <ul className="mt-4 space-y-2.5">
                {r.items.map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-fg-muted">
                    <Icon
                      name={r.itemIcon}
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${r.phase === "Now" ? "text-success" : "text-fg-subtle"}`}
                    />
                    {i}
                  </li>
                ))}
              </ul>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}