"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function SecurityCta({ enterprise }: { enterprise: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-border"
    >
      {/* Purple/cyan ambient wash. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(50% 90% at 0% 50%, rgba(124,92,255,0.16), transparent 70%), radial-gradient(45% 90% at 100% 50%, rgba(34,211,238,0.12), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 grid-overlay opacity-50 [mask-image:radial-gradient(80%_100%_at_50%_50%,#000,transparent)]"
        aria-hidden
      />
      {/* Restrained ambient detail: a dot drifting along a hidden orbital path. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 800 240" fill="none" preserveAspectRatio="none">
        <path id="sec-cta-orbit" d="M0 180 C220 180 320 60 520 70 C660 78 720 130 800 110" stroke="url(#secCtaGrad)" strokeWidth="1" strokeDasharray="3 9" />
        {!reduceMotion && (
          <circle r="2" className="fill-ai">
            <animateMotion dur="8s" repeatCount="indefinite">
              <mpath href="#sec-cta-orbit" />
            </animateMotion>
          </circle>
        )}
        <defs>
          <linearGradient id="secCtaGrad" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7c5cff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0.3" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative flex flex-col items-center gap-5 p-10 text-center sm:p-14">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-brand/25 bg-brand-soft text-brand shadow-[0_0_28px_-6px_rgba(124,92,255,0.5)]">
          <Icon name="Lock" className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
            Trusted by builders
          </span>
          <h2 className="text-balance mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Build with confidence
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-fg-muted">
            Security, privacy, and control — so you can focus on what matters.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <a href="/signup" className="w-full sm:w-auto">
            <Button size="lg" variant="ai" className="w-full sm:w-auto">
              Start building
              <Icon name="ArrowRight" className="h-4 w-4" aria-hidden />
            </Button>
          </a>
          <a href="/contact" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              <Icon name="ShieldCheck" className="h-4 w-4" aria-hidden />
              Request a security review
            </Button>
          </a>
        </div>

        {/* Preserves the existing enterprise-review offering. */}
        <p className="max-w-xl text-xs leading-relaxed text-fg-subtle">{enterprise}</p>
      </div>
    </motion.div>
  );
}