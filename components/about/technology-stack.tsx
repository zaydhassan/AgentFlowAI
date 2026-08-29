// Technology stack — only technologies confirmed in package.json / repo docs
// (Next.js, React Flow via @xyflow/react, Prisma + PostgreSQL, Redis + BullMQ,
// LangGraph, MCP SDK, Docker). No invented stack entries. Server component.

import { BlurReveal } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

const STACK = [
  { label: "Next.js 16", icon: "Cpu" },
  { label: "React Flow", icon: "Workflow" },
  { label: "LangGraph", icon: "BrainCircuit" },
  { label: "Model Context Protocol", icon: "Plug" },
  { label: "PostgreSQL · Prisma", icon: "Database" },
  { label: "Redis · BullMQ", icon: "Layers" },
  { label: "Docker", icon: "Boxes" },
  { label: "Sentry", icon: "Activity" },
] as const;

export function TechnologyStack() {
  return (
    <section className="border-y border-border bg-bg-soft/30">
      <BlurReveal className="mx-auto max-w-6xl px-5 py-16 text-center lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">
          Under the hood
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          The stack AgentFlow actually runs on.
        </h2>
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {STACK.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-2 rounded-full border border-border bg-surface-2/50 px-4 py-2 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              <Icon name={s.icon} className="h-3.5 w-3.5 text-brand" />
              {s.label}
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-8 max-w-xl text-xs leading-relaxed text-fg-subtle">
          A single Next.js runtime with Postgres for state and Redis + BullMQ for queueing — the
          same architecture documented in our repo, deployed as Docker containers.
        </p>
      </BlurReveal>
    </section>
  );
}