"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { CoreConcept, ConceptTone } from "@/components/marketing/core-concept-card";

export type { ConceptTone };

const DOT_TONE: Record<ConceptTone, string> = {
  brand: "bg-brand",
  ai: "bg-ai",
  success: "bg-success",
  warning: "bg-warning",
};

const ICON_TONE: Record<ConceptTone, string> = {
  brand: "bg-brand-soft text-brand",
  ai: "bg-ai/10 text-ai",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

const cardVariants: Variants = {
  rest: { y: 0 },
  hover: { y: -3 },
};

const HOVER_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

export function ConceptCard({ concept, index }: { concept: CoreConcept; index: number }) {
  const { icon, category, title, body, bullets, href, tone } = concept;

  return (
    // OUTER: staggered viewport reveal.
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.08 }}
      className="h-full"
    >
      {/* INNER: hover lift + border/glow brightening; variant labels propagate
          to the contextual visual so one hover drives the whole card. */}
      <motion.div
        variants={cardVariants}
        initial="rest"
        animate="rest"
        whileHover="hover"
        transition={HOVER_TRANSITION}
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-surface-2/80",
          "transition-[border-color,box-shadow] duration-200 ease-out",
          "hover:border-brand/30 hover:shadow-[0_20px_48px_-16px_rgba(124,92,255,0.3)]"
        )}
      >
        {/* Thin gradient border accent along the top edge. */}
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand/50 via-brand-2/30 to-ai/50 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        />
        {/* Ambient glow, strengthening slightly on hover. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
          style={{
            background:
              "radial-gradient(50% 30% at 15% 0%, rgba(124,92,255,0.08), transparent 70%), radial-gradient(45% 30% at 95% 100%, rgba(34,211,238,0.06), transparent 70%)",
          }}
        />

        <div className="relative flex h-full flex-col p-7 sm:p-8">
          {/* Header: icon tile + category label. */}
          <div className="flex items-center gap-4">
            <motion.div
              variants={{ rest: { scale: 1 }, hover: { scale: 1.05 } }}
              transition={HOVER_TRANSITION}
              className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", ICON_TONE[tone])}
            >
              <Icon name={icon} className="h-5.5 w-5.5" strokeWidth={1.75} />
            </motion.div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
              {category}
            </div>
          </div>

          {/* Title with tone dot — aligned across cards. */}
          <div className="mt-5 flex items-center gap-2.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE[tone])} aria-hidden />
            <h3 className="text-lg font-bold leading-tight tracking-tight text-fg">{title}</h3>
          </div>

          {/* Contextual visual — fixed-height focal point keeps cards aligned. */}
          <div className="mt-5 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-bg/50 px-4">
            <ConceptVisual title={title} />
          </div>

          <p className="mt-5 max-w-[46ch] text-sm leading-relaxed text-fg-muted">{body}</p>

          <ul className="mt-4 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm text-fg/90">
                <Icon name="Check" className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* Learn more — pinned to the bottom so all cards align. */}
          <div className="mt-auto pt-6">
            <Link
              href={href}
              aria-label={`Learn more about ${title}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-opacity hover:opacity-80 focus-ring rounded-sm"
            >
              Learn more
              <motion.span variants={{ rest: { x: 0 }, hover: { x: 4 } }} transition={HOVER_TRANSITION} className="inline-flex">
                <Icon name="ArrowRight" className="h-4 w-4" />
              </motion.span>
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Contextual illustrations for the four existing concepts. Decorative only —
// no new claims; each visualizes what the card's own copy already states.
function ConceptVisual({ title }: { title: string }) {
  switch (title) {
    case "Workflows & Nodes":
      return <NodeGraphVisual />;
    case "Agents & Memory":
      return <MemoryLayersVisual />;
    case "Execution & Self-healing":
      return <SelfHealVisual />;
    case "Secrets & Integrations":
      return <IntegrationsVisual />;
    default:
      return null;
  }
}

// Small typed-node graph: trigger → transform → AI step, with a moving pulse
// on hover (transition-based, disabled under reduced motion).
function NodeGraphVisual() {
  const nodes = [
    { icon: "Zap", label: "Trigger" },
    { icon: "Filter", label: "Route" },
    { icon: "Sparkles", label: "AI step" },
  ];
  return (
    <div aria-hidden className="flex w-full items-center justify-between gap-2">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-brand/25 bg-brand-soft/70 text-brand transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none">
              <Icon name={n.icon} className="h-4 w-4" />
            </span>
            <span className="text-[10px] text-fg-subtle">{n.label}</span>
          </div>
          {i < nodes.length - 1 && (
            <div className="relative mx-1 h-px flex-1 overflow-hidden rounded bg-gradient-to-r from-brand/40 to-ai/40">
              <span className="absolute inset-y-0 left-0 w-6 -translate-x-full bg-gradient-to-r from-transparent via-ai to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[calc(100%+2rem)] motion-reduce:transition-none" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Layered stack: Memory / Tools / RAG beneath the Agent layer.
function MemoryLayersVisual() {
  // Agent sits on top (the focal layer Memory/Tools/RAG feed into); each
  // layer below steps in by a fixed 24px so the pyramid reads as deliberate.
  const layers = [
    { label: "Agent", tone: "border-border-strong bg-surface-3/80 text-fg", step: 0 },
    { label: "Memory", tone: "border-brand/30 bg-brand-soft/50 text-brand", step: 24 },
    { label: "Tools", tone: "border-brand-2/25 bg-brand-2/5 text-brand-2", step: 48 },
    { label: "RAG", tone: "border-ai/25 bg-ai/5 text-ai", step: 72 },
  ];
  return (
    <div aria-hidden className="flex w-full max-w-[190px] flex-col items-center gap-1.5">
      {layers.map((l, i) => (
        <div
          key={l.label}
          style={{ width: `calc(100% - ${l.step}px)`, transitionDelay: `${i * 40}ms` }}
          className={`flex h-6 items-center justify-center rounded-md border transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none ${l.tone}`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider">{l.label}</span>
        </div>
      ))}
    </div>
  );
}

// Self-healing: shield with a check, plus a recovery ring that pulses on hover.
function SelfHealVisual() {
  return (
    <div aria-hidden className="relative grid place-items-center">
      <span className="absolute h-16 w-16 rounded-full border border-success/30 transition-transform duration-700 ease-out group-hover:scale-125 group-hover:opacity-60 motion-reduce:transition-none" />
      <span className="absolute h-11 w-11 rounded-full border border-success/40" />
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-success/30 bg-success/10 text-success">
        <Icon name="ShieldCheck" className="h-5 w-5" />
      </span>
      <span className="absolute -right-1 top-0 grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success transition-transform duration-300 group-hover:rotate-90 motion-reduce:transition-none">
        <Icon name="RefreshCw" className="h-3 w-3" />
      </span>
    </div>
  );
}

// Managed vault at the center, connected integration chips around it.
function IntegrationsVisual() {
  const chips = [
    { icon: "Lock", label: "Vault" },
    { icon: "Globe", label: "" },
    { icon: "Database", label: "" },
    { icon: "Mail", label: "" },
  ];
  return (
    <div aria-hidden className="flex w-full items-center justify-center gap-6">
      {chips.map((c, i) => (
        <div key={c.icon} className="relative flex flex-col items-center">
          {i > 0 && (
            <span className="absolute right-1/2 top-1/2 hidden h-px w-[calc(1.5rem+4px)] translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-brand/30 to-ai/30 sm:block" />
          )}
          <span
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg border text-fg-muted transition-colors duration-300 group-hover:text-fg motion-reduce:transition-none",
              i === 0 ? "border-warning/30 bg-warning/10 text-warning group-hover:text-warning" : "border-border bg-surface-3/60"
            )}
          >
            <Icon name={c.icon} className="h-4 w-4" />
          </span>
        </div>
      ))}
    </div>
  );
}