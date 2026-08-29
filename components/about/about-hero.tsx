"use client";

// About page hero — headline + abstract "agent orchestration core" visual.
// The visual is decorative (aria-hidden); rings reuse the existing
// .orbital-ring / .grid-overlay / .node-glow utilities, and every floating
// indicator names a real product pillar. All motion is gated on
// useReducedMotion.

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INDICATORS = [
  { icon: "ShieldCheck", label: "Reliability", color: "#34d399", className: "left-0 top-[12%]" },
  { icon: "Lock", label: "Security", color: "#7c5cff", className: "right-0 top-[26%]" },
  { icon: "Activity", label: "Observability", color: "#22d3ee", className: "bottom-[24%] left-[4%]" },
  { icon: "Bot", label: "AI Agents", color: "#5b8bff", className: "bottom-[2%] right-[6%]" },
] as const;

export function AboutHero() {
  const reduceMotion = useReducedMotion();
  const reveal = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Restrained ambient — soft radial + grid, no blobs. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(58% 62% at 72% 28%, rgba(124,92,255,0.13), transparent 70%)" }}
        aria-hidden
      />
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-50" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-12">
          {/* ── Left — copy ──────────────────────────────────────────── */}
          <div className="text-center lg:text-left">
            <motion.div {...reveal(0)}>
              <Badge
                tone="brand"
                className="bg-surface-2/80 text-brand shadow-[0_0_24px_-6px_rgba(124,92,255,0.55)]"
              >
                <span className="dot dot-live mr-1.5 bg-brand" />
                About AgentFlow
              </Badge>
            </motion.div>

            <motion.h1
              {...reveal(0.08)}
              className="mt-7 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
            >
              Built for autonomy.
              <br />
              <span className="text-brand-gradient">Designed for impact.</span>
            </motion.h1>

            <motion.p {...reveal(0.16)} className="mx-auto mt-6 max-w-xl text-lg text-fg-muted lg:mx-0">
              AgentFlow AI is the AI-native automation platform. We let teams ship workflows that
              think, plan, reason, remember, and self-heal — dependable enough to run while you
              sleep, observable enough to trust when they do.
            </motion.p>

            <motion.p {...reveal(0.2)} className="mx-auto mt-4 max-w-xl text-sm text-fg-subtle lg:mx-0">
              We are a small team obsessed with one thing: making autonomous agents a production
              tool, not a demo.
            </motion.p>

            <motion.div
              {...reveal(0.26)}
              className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
            >
              <Link href="/contact" className="w-full sm:w-auto">
                <Button size="lg" variant="ai" className="btn-shine w-full">
                  <Icon name="Mail" className="h-4 w-4" /> Talk to us
                </Button>
              </Link>
              <Link href="/#features" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full">
                  <Icon name="Sparkles" className="h-4 w-4" /> Explore the product
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* ── Right — orchestration core visual (decorative) ───────── */}
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[440px]"
            aria-hidden
          >
            <div className="relative aspect-square">
              {/* Grid, masked to a fading circle. */}
              <div
                className="grid-overlay absolute inset-[8%] rounded-full"
                style={{ maskImage: "radial-gradient(circle, black 30%, transparent 72%)", WebkitMaskImage: "radial-gradient(circle, black 30%, transparent 72%)" }}
              />

              {/* Orbital rings — existing 60s spin utility, reversed inner. */}
              <div className="orbital-ring absolute inset-0" />
              <div
                className="orbital-ring absolute inset-[13%]"
                style={{ animationDirection: "reverse", animationDuration: "90s" }}
              />
              <div className="absolute inset-[30%] rounded-full border border-border/70" />

              {/* Core stack — layered runtime. */}
              <div className="node-glow absolute inset-[36%]">
                <div className="absolute inset-0 translate-y-2.5 rounded-2xl border border-border bg-surface/70" />
                <div className="absolute inset-0 translate-y-1 rounded-2xl border border-border bg-surface-2/80" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-brand/30 bg-surface">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-brand/40 bg-brand-soft text-brand shadow-[0_0_24px_-4px_rgba(124,92,255,0.7)]">
                    <Icon name="BrainCircuit" className="h-6 w-6" />
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-fg-subtle">
                    Agent runtime
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-success">
                    <span className="dot dot-live bg-success" /> ready
                  </span>
                </div>
              </div>

              {/* Floating pillar indicators. */}
              {INDICATORS.map((ind, i) => (
                <motion.div
                  key={ind.label}
                  className={`absolute ${ind.className}`}
                  animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
                  transition={{ duration: 5 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                >
                  <span className="glass flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] text-fg-muted shadow-[0_6px_24px_-10px_rgba(0,0,0,0.5)]">
                    <Icon name={ind.icon} className="h-3.5 w-3.5" style={{ color: ind.color }} />
                    {ind.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}