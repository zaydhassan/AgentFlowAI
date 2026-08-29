import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { HeroFade } from "@/components/marketing/motion";
import { Badge } from "@/components/ui/badge";
import { site } from "@/lib/site";
import { ReleaseTimeline, RoadmapCTA, type ReleaseEntry } from "@/components/marketing/changelog";

export const metadata: Metadata = {
  title: "Changelog — AgentFlow AI",
  description: "Release notes for AgentFlow AI — what shipped, what changed, and what's next.",
};

// Release data verbatim from the previous changelog (do not fabricate extra
// entries, dates, or claims). `icon` + `accent` are presentation-only fields.
const entries: ReleaseEntry[] = [
  {
    version: "1.0.0",
    date: "July 9, 2026",
    tag: "Released",
    accent: "brand",
    icon: "Rocket",
    latest: true,
    notes: [
      { kind: "New", body: "Visual workflow builder with 60+ nodes and live graph execution." },
      { kind: "New", body: "AI agents with persistent memory, tools, and RAG — invoked as first-class nodes." },
      { kind: "New", body: "Self-healing runs: automatic retries, timeouts, and step-level recovery." },
      { kind: "New", body: "Per-workspace secrets vault with scoped integration tokens." },
      { kind: "New", body: "Execution observability: per-node latency, cost, and input/output inspection." },
      { kind: "New", body: "Credit-based billing with Free, Pro, Business, and Enterprise plans." },
    ],
  },
  {
    version: "0.9.2",
    date: "June 2026",
    tag: "Improved",
    accent: "ai",
    icon: "Zap",
    notes: [
      { kind: "Improved", body: "Agent memory lookups are now ~3x faster via indexed retrieval." },
      { kind: "Improved", body: "Workflow canvas supports copy/paste and multi-select wiring." },
      { kind: "Fixed", body: "Scheduled triggers no longer drift across DST boundaries." },
    ],
  },
  {
    version: "0.9.0",
    date: "May 2026",
    tag: "Improved",
    accent: "brand",
    icon: "CircleCheck",
    notes: [
      { kind: "New", body: "Self-healing execution engine with automatic step retries." },
      { kind: "New", body: "Audit log export for Business workspaces." },
      { kind: "Fixed", body: "OAuth nodes now correctly refresh expired tokens mid-run." },
    ],
  },
  {
    version: "0.8.0",
    date: "April 2026",
    tag: "Improved",
    accent: "ai",
    icon: "Layers",
    notes: [
      { kind: "New", body: "Persistent agent memory and retrieval (RAG) nodes." },
      { kind: "Improved", body: "Runtime isolation per tenant with resource limits." },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <MarketingPage>
      {/* ── Hero — centered, ambient glows, orbital rings, grid ────────── */}
      <section className="mesh-bg relative overflow-hidden">
        {/* Ambient background — fades in first, stays subtle. */}
        <HeroFade y={0} duration={1.4} className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="grid-overlay absolute inset-0 opacity-70 [mask-image:radial-gradient(70%_60%_at_50%_35%,black,transparent)]" />
          <div
            className="absolute -left-40 top-[-160px] h-[480px] w-[480px] rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.28), transparent 70%)" }}
          />
          <div
            className="absolute -right-40 top-[-120px] h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(34,211,238,0.22), transparent 70%)" }}
          />
          {/* Faint orbital arcs behind the heading. */}
          <div className="absolute left-1/2 top-24 h-[720px] w-[720px] -translate-x-1/2 opacity-50">
            <span className="orbital-ring absolute inset-0" style={{ animationDuration: "120s" }} />
            <span className="orbital-ring absolute -inset-16" style={{ animationDuration: "150s", animationDirection: "reverse" }} />
          </div>
          {/* Tiny particles */}
          <span className="dot dot-live absolute left-[18%] top-[26%] h-1 w-1 rounded-full bg-brand opacity-70" />
          <span className="dot dot-live absolute right-[22%] top-[40%] h-0.5 w-0.5 rounded-full bg-ai opacity-70" style={{ animationDelay: "1.2s" }} aria-hidden />
          <span className="dot dot-live absolute left-[62%] top-[14%] h-1 w-1 rounded-full bg-brand opacity-50" style={{ animationDelay: "2s" }} aria-hidden />
        </HeroFade>

        <div className="relative mx-auto max-w-3xl px-5 pb-20 pt-28 text-center lg:px-8">
          <HeroFade y={12} delay={0.05}>
            <Badge tone="ai" className="mx-auto">Changelog</Badge>
          </HeroFade>
          <HeroFade y={14} delay={0.15}>
            <h1 className="text-balance pt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Release{" "}
              <span className="bg-[linear-gradient(90deg,#a78bfa,_#7c5cff_45%,_#5b8bff_70%,_#22d3ee)] bg-clip-text text-transparent">
                notes
              </span>
            </h1>
          </HeroFade>
          <HeroFade y={14} delay={0.25}>
            <p className="mx-auto mt-5 max-w-xl text-lg text-fg-muted">
              What shipped, what changed, and what we fixed. The current platform version is{" "}
              <span className="font-medium text-fg">v{site.version}</span>.
            </p>
          </HeroFade>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 lg:px-8 pb-24 pt-6">
        <ReleaseTimeline entries={entries} />
        <RoadmapCTA />
      </section>
    </MarketingPage>
  );
}