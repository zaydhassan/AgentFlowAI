"use client";

// Contact page hero — "Let's talk". Ambient layer (glows, orbital curves,
// grid, tiny particles) is purely decorative; entrance uses the shared
// HeroFade mount animation. No continuous heavy motion.

import { HeroFade } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

// Tiny decorative particles — existing pulsing dot (disabled under
// prefers-reduced-motion by the .dot-live rule).
const PARTICLES = [
  { left: "18%", top: "30%", color: "#7c5cff", delay: "0s" },
  { left: "30%", top: "62%", color: "#34d399", delay: "1.2s" },
  { left: "66%", top: "26%", color: "#22d3ee", delay: "0.6s" },
  { left: "78%", top: "58%", color: "#7c5cff", delay: "1.8s" },
  { left: "50%", top: "18%", color: "#5b8bff", delay: "2.4s" },
] as const;

export function ContactHero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Ambient — left purple glow, right cyan glow, faint grid. */}
      <div
        className="pointer-events-none absolute -left-32 top-8 h-[420px] w-[520px] rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.16), transparent 70%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 top-16 h-[380px] w-[480px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(34,211,238,0.13), transparent 70%)" }}
        aria-hidden
      />
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      {/* Extremely subtle orbital curves, cropped by the section. */}
      <div className="orbital-ring absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 opacity-60" aria-hidden />
      <div
        className="orbital-ring absolute left-1/2 top-1/2 h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style={{ animationDuration: "120s", animationDirection: "reverse" }}
        aria-hidden
      />

      {/* Tiny particles */}
      {PARTICLES.map((p) => (
        <span
          key={`${p.left}-${p.top}`}
          className="dot dot-live absolute h-1 w-1 rounded-full opacity-70"
          style={{ left: p.left, top: p.top, background: p.color, boxShadow: `0 0 6px 1px ${p.color}66`, animationDelay: p.delay }}
          aria-hidden
        />
      ))}

      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center lg:px-8 lg:py-28">
        <HeroFade y={8} duration={0.5}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ai">Contact</p>
        </HeroFade>

        <HeroFade y={16} duration={0.6} delay={0.08}>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Let&rsquo;s <span className="text-anim-gradient">talk</span>
          </h1>
        </HeroFade>

        <HeroFade y={16} duration={0.6} delay={0.16}>
          <p className="mx-auto mt-5 max-w-xl text-lg text-fg-muted">
            Questions about the product, pricing, security, or partnerships? Pick the channel that
            fits — we read everything.
          </p>
        </HeroFade>

        <HeroFade y={10} duration={0.5} delay={0.24}>
          <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3.5 py-1.5 text-xs text-fg-muted">
            <Icon name="Mail" className="h-3.5 w-3.5 text-success" />
            We reply to every message
          </p>
        </HeroFade>
      </div>
    </section>
  );
}