"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HeroFade } from "@/components/marketing/motion";
import { Badge } from "@/components/ui/badge";

// Deterministic particle positions (no Math.random at render — hydration-safe).
const PARTICLES = [
  { left: "9%", top: "30%", size: 2, delay: 0.4, dur: 8 },
  { left: "18%", top: "64%", size: 3, delay: 1.8, dur: 9 },
  { left: "30%", top: "22%", size: 2, delay: 0.9, dur: 7.5 },
  { left: "42%", top: "74%", size: 2, delay: 2.4, dur: 8.5 },
  { left: "55%", top: "18%", size: 3, delay: 0.2, dur: 9.5 },
  { left: "67%", top: "62%", size: 2, delay: 1.4, dur: 7 },
  { left: "79%", top: "34%", size: 2, delay: 2.9, dur: 8.8 },
  { left: "90%", top: "70%", size: 3, delay: 1.1, dur: 9.2 },
];

export function PrivacyHero({ lastUpdated }: { lastUpdated: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Ambient background — glows, fine grid, faint orbital arcs, particles.
          Everything stays well behind the text. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* Purple glow left, cyan glow right. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(38% 45% at 8% 35%, rgba(124,92,255,0.13), transparent 70%), radial-gradient(34% 42% at 92% 30%, rgba(34,211,238,0.10), transparent 70%), radial-gradient(30% 30% at 50% 0%, rgba(91,139,255,0.06), transparent 70%)",
          }}
        />

        {/* Fine technical grid, faded out from the center. */}
        <div className="grid-overlay absolute inset-0 [mask-image:radial-gradient(70%_80%_at_50%_40%,#000,transparent)]" />

        {/* Faint orbital curves. */}
        <div className="absolute left-1/2 top-[-46%] h-[560px] w-[560px] -translate-x-1/2 rounded-full border border-brand/10 [mask-image:linear-gradient(to_bottom,#000_60%,transparent)]" />
        <div className="absolute left-1/2 top-[-60%] h-[820px] w-[820px] -translate-x-1/2 rounded-full border border-ai/10 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]" />

        {/* Tiny drifting particles (static under reduced motion). */}
        {PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-fg-subtle"
            style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
            initial={{ opacity: 0 }}
            animate={
              reduceMotion
                ? { opacity: 0.25 }
                : { opacity: [0.1, 0.5, 0.1], y: [0, -12, 0] }
            }
            transition={
              reduceMotion
                ? { duration: 0.4, delay: p.delay }
                : { duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }
            }
          />
        ))}

        {/* Bottom fade into the page background for a seamless seam. */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
      </div>

      <div className="relative mx-auto max-w-3xl px-5 pb-14 pt-24 text-center lg:px-8 lg:pt-28">
        <HeroFade>
          <Badge tone="ai" className="mx-auto">Legal</Badge>
        </HeroFade>
        <HeroFade delay={0.08}>
          <h1 className="text-balance mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Privacy{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(110deg, #8b7bff, #5b8bff, #22d3ee)",
              }}
            >
              Policy
            </span>
          </h1>
        </HeroFade>
        <HeroFade delay={0.16}>
          <p className="mt-4 text-sm text-fg-subtle">Last updated: {lastUpdated}</p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
            AgentFlow AI (&ldquo;we&rdquo;, &ldquo;us&rdquo;) builds automation tooling. This
            policy explains what data we collect, why we collect it, and the controls you have
            over it.
          </p>
        </HeroFade>
      </div>
    </section>
  );
}