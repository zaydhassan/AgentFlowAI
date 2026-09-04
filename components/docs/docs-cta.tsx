"use client";

import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function DocumentationCta() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border">
      {/* Dark center with purple glow left, cyan glow right. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(50% 90% at 0% 50%, rgba(124,92,255,0.16), transparent 70%), radial-gradient(45% 90% at 100% 50%, rgba(34,211,238,0.12), transparent 70%)",
        }}
      />
      {/* Thin gradient border accent. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand/50 via-brand-2/30 to-ai/50"
        aria-hidden
      />
      {/* Animated workflow lines drifting behind the content. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-50"
        viewBox="0 0 800 100"
        fill="none"
        preserveAspectRatio="none"
      >
        <path id="cta-line-1" d="M0 30 C150 30 250 70 400 50 C550 30 650 70 800 55" stroke="url(#ctaGrad)" strokeWidth="1" strokeDasharray="4 10" />
        <path id="cta-line-2" d="M0 75 C200 75 300 25 450 40 C600 55 700 35 800 20" stroke="url(#ctaGrad)" strokeWidth="1" strokeDasharray="4 10" />
        {!reduceMotion && (
          <>
            <circle r="2" className="fill-brand">
              <animateMotion dur="7s" repeatCount="indefinite">
                <mpath href="#cta-line-1" />
              </animateMotion>
            </circle>
            <circle r="2" className="fill-ai">
              <animateMotion dur="9s" repeatCount="indefinite">
                <mpath href="#cta-line-2" />
              </animateMotion>
            </circle>
          </>
        )}
        <defs>
          <linearGradient id="ctaGrad" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7c5cff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0.3" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative flex flex-col items-center gap-6 p-10 text-center sm:p-14">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to build?</h2>
        <p className="max-w-md text-fg-muted">Start free with 1,000 credits — no card required.</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <a href="/signup" className="w-full sm:w-auto">
            <Button size="lg" variant="ai" className="w-full sm:w-auto">
              <Icon name="Rocket" className="h-4 w-4" aria-hidden /> Get started free
            </Button>
          </a>
          <a href="/docs/workflows" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              View docs
              <Icon name="ArrowRight" className="h-4 w-4" aria-hidden />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}