"use client";

import Link from "next/link";
import { StaggerContainer, StaggerItem } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

type Feature = {
  icon: string;
  category: string;
  title: string;
  desc: string;
  bullets: string[];
  href: string;
  accent: string;
};

const FEATURES: Feature[] = [
  {
    icon: "Workflow",
    category: "Builder",
    title: "AI Workflows",
    desc: "Compose autonomous agents on a visual canvas that reasons over every step — not just at the end.",
    bullets: ["Drag-and-drop canvas", "Natural-language build", "Reusable templates"],
    href: "/workflows",
    accent: "#7c5cff",
  },
  {
    icon: "Brain",
    category: "Context",
    title: "Memory Engine",
    desc: "Long-term vector memory that persists across runs, users, and sessions for true continuity.",
    bullets: ["Long-term vector memory", "Per-user & per-run context", "Semantic recall"],
    href: "/ai/memory",
    accent: "#22d3ee",
  },
  {
    icon: "Bot",
    category: "Execution",
    title: "Multi-Agent Runtime",
    desc: "Run parallel agents with role-based orchestration and transparent reasoning traces.",
    bullets: ["Parallel agent execution", "Role-based orchestration", "Transparent reasoning"],
    href: "/ai/agents",
    accent: "#5b8bff",
  },
  {
    icon: "Boxes",
    category: "Connectivity",
    title: "200+ Integrations",
    desc: "Connect anything out of the box, or build your own nodes with the SDK.",
    bullets: ["200+ prebuilt nodes", "Custom node SDK", "OAuth + webhooks"],
    href: "/marketplace",
    accent: "#34d399",
  },
  {
    icon: "ShieldCheck",
    category: "Trust",
    title: "Enterprise Security",
    desc: "SOC 2-aligned controls, RBAC, audit logs, and SSO — enterprise-grade by default.",
    bullets: ["SOC 2 controls", "RBAC + audit logs", "SSO / SAML ready"],
    href: "/security",
    accent: "#fbbf24",
  },
  {
    icon: "Wrench",
    category: "Protocol",
    title: "MCP Support",
    desc: "Native Model Context Protocol support with dynamic tool discovery and standard calls.",
    bullets: ["Model Context Protocol", "Dynamic tool discovery", "Standard tool calls"],
    href: "/docs",
    accent: "#a855f7",
  },
];

export function FeatureCards() {
  return (
    <StaggerContainer
      stagger={0.08}
      className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {FEATURES.map((f) => (
        <StaggerItem key={f.title} className="h-full">
          <div className="surface-premium feature-card group h-full rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div
                className="feature-icon grid h-11 w-11 place-items-center rounded-xl"
                style={{
                  background: `${f.accent}1a`,
                  color: f.accent,
                  boxShadow: `0 0 24px -6px ${f.accent}80, inset 0 0 0 1px ${f.accent}33`,
                }}
              >
                <Icon name={f.icon} className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-border bg-surface-3/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                {f.category}
              </span>
            </div>

            <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.desc}</p>

            <ul className="mt-4 space-y-2">
              {f.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 text-[13px] text-fg-muted">
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
                    style={{ background: `${f.accent}22`, color: f.accent }}
                  >
                    <Icon name="Check" className="h-3 w-3" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <Link
              href={f.href}
              className="group/link mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fg transition-colors hover:text-brand"
            >
              Learn More
              <Icon
                name="ArrowRight"
                className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-1"
              />
            </Link>
          </div>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}