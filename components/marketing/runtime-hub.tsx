"use client";

// "One runtime. Infinite workflows." — orchestration-runtime showcase that
// replaces the homepage's closing CTA block:
//   1. compact demo pipeline (real node types from lib/nodes, labeled demo)
//   2. heading block
//   3. central hexagonal AgentFlow core with orbital rings + flowing
//      particles, connected to 6 feature callouts (3 left / 3 right on lg+)
//   4. premium CTA, visually connected with flowing gradient lines
//
// Honesty rules: node labels/icons resolve from NODE_LIBRARY; the node count
// is computed from the library (no fabricated "200+"); no live metrics —
// status dots are decorative "ready" indicators only. All motion is gated on
// useReducedMotion; connector particles/orbits stop under it.

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlurReveal, StaggerContainer, StaggerItem } from "@/components/marketing/motion";
import { FlowChain, type FlowNodeItem } from "@/components/marketing/flow-chain";
import { NODE_LIBRARY } from "@/lib/nodes";

// ── Real node definitions (throw at module scope if the library changes) ───
function nodeOf(type: string) {
  const def = NODE_LIBRARY.find((n) => n.type === type);
  if (!def) throw new Error(`node def missing: ${type}`);
  return def;
}

const DEMO_TYPES = [
  { type: "ai.openai", sub: "AI Model" },
  { type: "ai.agent", sub: "Reasoning" },
  { type: "store.postgres", sub: "Database" },
  { type: "comm.slack", sub: "Alerts" },
] as const;

const DEMO_PIPELINE: FlowNodeItem[] = DEMO_TYPES.map(({ type, sub }) => {
  const def = nodeOf(type);
  return { label: def.label, sub, icon: def.icon, color: def.color };
});

// Honest count derived from the library (74 → "70+").
const NODE_COUNT = NODE_LIBRARY.length;
const HEADLINE_COUNT = Math.floor(NODE_COUNT / 10) * 10;

// ── Feature callouts (system components, not dashboard cards) ──────────────
type CalloutData = {
  icon: string;
  title: string;
  body: string;
  accent: string;
};

const LEFT_CALLOUTS: CalloutData[] = [
  {
    icon: "Plug",
    title: "Connect anything",
    body: `${HEADLINE_COUNT}+ pre-built nodes to connect your apps, data, models, and services.`,
    accent: "#7c5cff",
  },
  {
    icon: "BrainCircuit",
    title: "AI that acts",
    body: "LLM agents with tools, memory, and RAG to reason and take action.",
    accent: "#5b8bff",
  },
  {
    icon: "Terminal",
    title: "Built for developers",
    body: "TypeScript-first SDK, API, and CLI to extend and automate everything.",
    accent: "#22d3ee",
  },
];

const RIGHT_CALLOUTS: CalloutData[] = [
  {
    icon: "Eye",
    title: "Observe everything",
    body: "Trace every step, inspect I/O, track latency, cost, and failures.",
    accent: "#22d3ee",
  },
  {
    icon: "ShieldCheck",
    title: "Reliable by design",
    body: "Retries, fallbacks, timeouts and idempotency built into every run.",
    accent: "#34d399",
  },
  {
    icon: "Rocket",
    title: "Scale without limits",
    body: "Stateless execution, queues, and parallelism to scale with your needs.",
    accent: "#5b8bff",
  },
];

// Hub satellites — real node categories around the core.
const SAT_TOP = {
  label: "Database",
  icon: nodeOf("store.postgres").icon,
  color: nodeOf("store.postgres").color,
};
const SAT_BOTTOM = {
  label: "Messaging",
  icon: nodeOf("comm.slack").icon,
  color: nodeOf("comm.slack").color,
};

export function RuntimeHubSection() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden border-t border-border">
      {/* Ambient — grid texture + two restrained radials. */}
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-24 h-[540px] w-[880px] max-w-full -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.14), transparent 70%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-40 left-1/2 h-[380px] w-[680px] max-w-full -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(34,211,238,0.1), transparent 70%)" }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        {/* ── 1. Demo pipeline (real node types) ─────────────────────── */}
        <BlurReveal className="mx-auto max-w-3xl">
          <FlowChain nodes={DEMO_PIPELINE} />
          <p className="mt-3 text-center text-[10px] text-fg-subtle">
            Demo pipeline — real node types from the library, not live execution data.
          </p>
        </BlurReveal>

        {/* ── 2. Heading block ──────────────────────────────────────── */}
        <BlurReveal delay={0.08} className="mx-auto mt-20 max-w-3xl text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-brand/60" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
              What makes AgentFlow different
            </p>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-brand/60" aria-hidden />
          </div>
          <h2 className="mt-6 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            One <span className="text-brand">runtime.</span>
            <br />
            Infinite <span className="text-anim-gradient">workflows.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-fg-muted">
            AgentFlow is an event-driven agent orchestration platform.
            <br className="hidden sm:block" />
            We handle the hard parts so you can focus on building outcomes.
          </p>
        </BlurReveal>

        {/* ── 3. Hub + callouts ─────────────────────────────────────── */}
        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-6 xl:gap-8">
          {/* Left callouts — stack on mobile, 2-col on sm, rail on lg */}
          <StaggerContainer
            stagger={0.1}
            className="order-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:order-1 lg:flex lg:flex-col lg:justify-center lg:gap-14"
          >
            {LEFT_CALLOUTS.map((c, i) => (
              <Callout
                key={c.title}
                data={c}
                side="left"
                calloutKey={`left-${i}`}
                active={active}
                onEnter={setActive}
                onLeave={() => setActive(null)}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </StaggerContainer>

          {/* Central hub */}
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative order-1 lg:order-2"
          >
            <Hub active={active !== null} reduceMotion={Boolean(reduceMotion)} />
          </motion.div>

          {/* Right callouts */}
          <StaggerContainer
            stagger={0.1}
            className="order-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-col lg:justify-center lg:gap-14"
          >
            {RIGHT_CALLOUTS.map((c, i) => (
              <Callout
                key={c.title}
                data={c}
                side="right"
                calloutKey={`right-${i}`}
                active={active}
                onEnter={setActive}
                onLeave={() => setActive(null)}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </StaggerContainer>
        </div>

        {/* ── 4. Connector lines down to the CTA ────────────────────── */}
        <CtaConnectors reduceMotion={Boolean(reduceMotion)} />

        {/* ── 5. CTA ────────────────────────────────────────────────── */}
        <BlurReveal className="relative overflow-hidden rounded-3xl border border-border mesh-bg p-12 text-center lg:p-20">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(124,92,255,0.6), rgba(34,211,238,0.6), transparent)" }}
            aria-hidden
          />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Automate like you mean it.</h2>
            <p className="mx-auto mt-4 max-w-xl text-fg-muted">Spin up your first AI-native workflow in minutes. Free to start, no card required.</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup"><Button size="lg" variant="ai" className="btn-shine"><Icon name="Rocket" className="h-4 w-4" /> Get started free</Button></Link>
              <Link href="/dashboard"><Button size="lg" variant="secondary" className="btn-shine"><Icon name="LayoutDashboard" className="h-4 w-4" /> View live demo</Button></Link>
            </div>
          </div>
        </BlurReveal>
      </div>
    </section>
  );
}

/* ── Feature callout — compact connected system component ─────────────── */

function Callout({
  data,
  side,
  calloutKey,
  active,
  onEnter,
  onLeave,
  reduceMotion,
}: {
  data: CalloutData;
  side: "left" | "right";
  calloutKey: string;
  active: string | null;
  onEnter: (key: string) => void;
  onLeave: () => void;
  reduceMotion: boolean;
}) {
  const isActive = active === calloutKey;
  return (
    <StaggerItem className="relative h-full">
      {/* Thin connector into the hub — lg+ only, on the hub-facing edge.
          Anchored to this wrapper so it spans exactly the grid gap. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 hidden h-px w-6 -translate-y-1/2 lg:block xl:w-8"
        style={{
          [side === "left" ? "left" : "right"]: "100%",
          background: `linear-gradient(${side === "left" ? "90deg" : "270deg"}, ${data.accent}${isActive ? "99" : "40"}, ${data.accent}${isActive ? "cc" : "88"})`,
        }}
      >
        {!reduceMotion && (
          <span
            className="nl-particle absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full"
            style={{
              background: data.accent,
              boxShadow: `0 0 6px 1px ${data.accent}aa`,
              animationDirection: side === "right" ? "reverse" : undefined,
              animationDuration: "2.8s",
            }}
          />
        )}
      </span>
      <div
        onMouseEnter={() => onEnter(calloutKey)}
        onMouseLeave={onLeave}
        className={`h-full rounded-xl border p-4 transition-all duration-300 ${
          isActive
            ? "border-brand/40 bg-surface-2/80 shadow-[0_0_30px_-10px_rgba(124,92,255,0.55)]"
            : "border-border bg-surface-2/40 hover:border-border-strong hover:bg-surface-2/70"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-shadow duration-300"
            style={{
              background: `${data.accent}1a`,
              color: data.accent,
              boxShadow: `inset 0 0 0 1px ${data.accent}33${isActive ? `, 0 0 16px -2px ${data.accent}88` : ""}`,
            }}
          >
            <Icon name={data.icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">{data.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">{data.body}</p>
          </div>
        </div>
      </div>
    </StaggerItem>
  );
}

/* ── Central orchestration hub ─────────────────────────────────────────── */

function Hub({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[420px]">
      {/* Faint static outer circle */}
      <div className="absolute inset-[3%] rounded-full border border-dashed border-border/60" aria-hidden />
      {/* Orbital rings with traveling dots (existing 60s spin utility). */}
      <div className="orbital-ring absolute inset-[14%]" aria-hidden />
      <div
        className="orbital-ring absolute inset-[27%]"
        style={{ animationDirection: "reverse", animationDuration: "90s" }}
        aria-hidden
      />

      {/* Breathing halo — the runtime "alive" glow. */}
      <div
        className={`hub-breathe absolute inset-[27%] rounded-full blur-2xl transition-opacity duration-500 ${
          active ? "opacity-100" : "opacity-70"
        }`}
        style={{
          background:
            "radial-gradient(circle, rgba(124,92,255,0.32), rgba(34,211,238,0.12) 55%, transparent 75%)",
        }}
        aria-hidden
      />

      {/* Vertical connectors: Database (top) and Messaging (bottom). */}
      <HubLine top="8%" height="26%" color={SAT_TOP.color} reduceMotion={reduceMotion} />
      <HubLine top="66%" height="26%" color={SAT_BOTTOM.color} reduceMotion={reduceMotion} />

      {/* Satellites */}
      <span
        className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface-2/80 px-2.5 py-1.5 text-[10px] text-fg-muted"
        aria-hidden
      >
        <Icon name={SAT_TOP.icon} className="h-3 w-3" style={{ color: SAT_TOP.color }} />
        {SAT_TOP.label}
      </span>
      <span
        className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface-2/80 px-2.5 py-1.5 text-[10px] text-fg-muted"
        aria-hidden
      >
        <Icon name={SAT_BOTTOM.icon} className="h-3 w-3" style={{ color: SAT_BOTTOM.color }} />
        {SAT_BOTTOM.label}
      </span>

      {/* Core — layered hexagon, gradient hairline border via clip-path. */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 ${
          active ? "scale-[1.04]" : ""
        }`}
      >
        <div className="hub-hex bg-gradient-to-br from-brand/70 via-ai/40 to-brand-2/60 p-px shadow-[0_0_60px_-12px_rgba(124,92,255,0.6)]">
          <div className="hub-hex grid h-28 w-28 place-items-center bg-surface-2 sm:h-32 sm:w-32">
            <div className="flex flex-col items-center gap-1.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/40 bg-brand-soft text-brand shadow-[0_0_20px_-4px_rgba(124,92,255,0.7)]">
                <Icon name="Workflow" className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest">AgentFlow</span>
              <span className="flex items-center gap-1 text-[9px] text-success">
                <span className="dot dot-live scale-75 bg-success" /> ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HubLine({
  top,
  height,
  color,
  reduceMotion,
}: {
  top: string;
  height: string;
  color: string;
  reduceMotion: boolean;
}) {
  return (
    <span
      aria-hidden
      className="absolute left-1/2 w-px -translate-x-1/2"
      style={{ top, height, background: `linear-gradient(180deg, transparent, ${color}88, transparent)` }}
    >
      {!reduceMotion && (
        <span
          className="nl-particle-y absolute left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px 1px ${color}aa`, animationDuration: "3s" }}
        />
      )}
    </span>
  );
}

/* ── Flowing connectors between hub and CTA ────────────────────────────── */

function CtaConnectors({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <svg
      viewBox="0 0 800 110"
      fill="none"
      aria-hidden
      className="relative mx-auto -mt-1 h-16 max-w-3xl lg:h-24"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="rh-cta-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Center drop + two side curves into the CTA panel. */}
      <path d="M400 4 L400 106" stroke="url(#rh-cta-grad)" strokeOpacity="0.45" strokeWidth="1.2" />
      <path d="M170 8 C260 44 330 70 356 106" stroke="#7c5cff" strokeOpacity="0.3" strokeWidth="1" />
      <path d="M630 8 C540 44 470 70 444 106" stroke="#22d3ee" strokeOpacity="0.3" strokeWidth="1" />
      {!reduceMotion && (
        <>
          <circle r="2" fill="#7c5cff" opacity="0.9">
            <animateMotion dur="3.2s" repeatCount="indefinite" path="M400 4 L400 106" />
          </circle>
          <circle r="1.6" fill="#a78bfa" opacity="0.8">
            <animateMotion dur="3.8s" begin="0.8s" repeatCount="indefinite" path="M170 8 C260 44 330 70 356 106" />
          </circle>
          <circle r="1.6" fill="#22d3ee" opacity="0.8">
            <animateMotion dur="3.8s" begin="1.6s" repeatCount="indefinite" path="M630 8 C540 44 470 70 444 106" />
          </circle>
        </>
      )}
    </svg>
  );
}